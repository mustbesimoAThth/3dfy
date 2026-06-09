"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { ImageDropzone } from "@/components/ImageDropzone";
import { MultiImageDropzone } from "@/components/MultiImageDropzone";
import { ModelPicker } from "@/components/ModelPicker";
import { GenerationOptions } from "@/components/GenerationOptions";
import { JobCard } from "@/components/JobCard";
import { tryCreateSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  estimateCost,
  H31_MV_MAX_IMAGES,
  RECON_MAX_IMAGES,
  type GenerateRequest,
  type H31Options,
  type P1Options,
  type ReconOptions,
} from "@/lib/fal";
import type { PreparedImage } from "@/lib/image";
import type { FalModelId, JobRow } from "@/lib/types/database";

/** Per-model image cap. Models not listed here are single-image. */
const MAX_IMAGES_BY_MODEL: Partial<Record<FalModelId, number>> = {
  "fal-ai/reconviagen-0.5": RECON_MAX_IMAGES,
  "tripo3d/h3.1/multiview-to-3d": H31_MV_MAX_IMAGES,
};

export function Studio({
  initialJobs,
  userId,
}: {
  initialJobs: JobRow[];
  userId: string;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [images, setImages] = useState<PreparedImage[]>([]);
  const [model, setModel] = useState<FalModelId>("fal-ai/reconviagen-0.5");
  const [recon, setRecon] = useState<ReconOptions>({
    resolution: 1024,
    texture_size: 2048,
    ss_source: "mesh",
  });
  const [p1, setP1] = useState<P1Options>({ texture: true });
  const [h31, setH31] = useState<H31Options>({
    texture: "standard",
    detailed_geometry: false,
    quad: false,
    pbr: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => tryCreateSupabaseBrowserClient(), []);

  const maxImages = MAX_IMAGES_BY_MODEL[model] ?? 1;
  const isMultiView = maxImages > 1;

  // Realtime updates on this user's jobs.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`jobs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` },
        (payload: {
          eventType: string;
          new: Record<string, unknown>;
          old: Record<string, unknown>;
        }) => {
          setJobs((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as unknown as JobRow;
              if (prev.some((j) => j.id === row.id)) return prev;
              return [row, ...prev].slice(0, 48);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as unknown as JobRow;
              return prev.map((j) => (j.id === row.id ? row : j));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as unknown as JobRow;
              return prev.filter((j) => j.id !== row.id);
            }
            return prev;
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  // Sign URLs for input previews so thumbnails load even before fal returns one.
  useEffect(() => {
    const missing = jobs.filter(
      (j) => !previewUrls[j.id] && !j.preview_image_url && j.input_image_path,
    );
    if (missing.length === 0) return;
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(
        missing.map(async (j) => {
          const { data } = await supabase.storage
            .from("inputs")
            .createSignedUrl(j.input_image_path, 60 * 30);
          if (data?.signedUrl) updates[j.id] = data.signedUrl;
        }),
      );
      if (!cancelled && Object.keys(updates).length > 0) {
        setPreviewUrls((p) => ({ ...p, ...updates }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobs, previewUrls, supabase]);

  // Trim the image list down when switching from a multi-view model to a
  // single-image one so we never submit more inputs than the model accepts.
  useEffect(() => {
    setImages((prev) => {
      if (prev.length <= maxImages) return prev;
      for (const dropped of prev.slice(maxImages)) {
        URL.revokeObjectURL(dropped.previewUrl);
      }
      return prev.slice(0, maxImages);
    });
  }, [maxImages]);

  // Build a request shape just for cost estimation. The image fields use
  // placeholder values — they don't affect the estimate.
  const requestForEstimate: GenerateRequest = buildRequest(
    model,
    ["_"],
    recon,
    p1,
    h31,
  );

  const cost = estimateCost(requestForEstimate);

  async function onGenerate() {
    if (images.length === 0 || submitting) return;
    if (!supabase) {
      setError(
        "Supabase is not configured in the browser bundle. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for this environment in Vercel and redeploy.",
      );
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Upload every input image first, in order.
      const paths: string[] = [];
      for (const img of images) {
        const ext = (img.filename.split(".").pop() || "webp").toLowerCase();
        const path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("inputs")
          .upload(path, img.blob, {
            contentType: img.blob.type || "image/webp",
            upsert: false,
          });
        if (upErr) throw upErr;
        paths.push(path);
      }

      const body: GenerateRequest = buildRequest(model, paths, recon, p1, h31);

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `Request failed (${res.status})`);
      }
      const json = (await res.json()) as { jobId: string };
      // Reset images, keep options.
      for (const img of images) URL.revokeObjectURL(img.previewUrl);
      setImages([]);
      router.push(`/app/${json.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">New generation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop an image, pick a model, hit generate. Long jobs run in the
            background — you can leave this page.
          </p>
        </header>

        {isMultiView ? (
          <MultiImageDropzone
            value={images}
            onChange={setImages}
            max={maxImages}
            disabled={submitting}
          />
        ) : (
          <ImageDropzone
            value={images[0] ?? null}
            onChange={(img) => {
              if (img) setImages([img]);
              else setImages([]);
            }}
            disabled={submitting}
          />
        )}

        <div>
          <h2 className="mb-2 text-sm font-medium">Model</h2>
          <ModelPicker
            value={model}
            onChange={setModel}
            disabled={submitting}
          />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-medium">Options</h2>
          <GenerationOptions
            model={model}
            recon={recon}
            p1={p1}
            h31={h31}
            onChangeRecon={setRecon}
            onChangeP1={setP1}
            onChangeH31={setH31}
            disabled={submitting}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="sticky bottom-4 z-10 flex flex-col items-stretch gap-2 rounded-2xl border border-border/60 bg-background/80 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {model === "fal-ai/reconviagen-0.5" ? (
              <>
                Est. from{" "}
                <span className="font-medium text-foreground">
                  ${cost.toFixed(2)}
                </span>{" "}
                <span className="opacity-80">(metered usage)</span>
              </>
            ) : (
              <>
                Estimated cost{" "}
                <span className="font-medium text-foreground">
                  ${cost.toFixed(2)}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            disabled={!supabase || images.length === 0 || submitting}
            onClick={onGenerate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generate
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent</h2>
          {jobs.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
            </span>
          )}
        </header>
        {jobs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-8 text-center text-sm text-muted-foreground backdrop-blur">
            No generations yet. Drop your first image to get started.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {jobs.map((j) => (
              <JobCard
                key={j.id}
                job={j}
                previewUrl={j.preview_image_url ?? previewUrls[j.id] ?? null}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Build the discriminated request body for the chosen model. Single-image
 * models read only the first path; multi-image models read all of them.
 *
 * Note: `tripo3d/h3.1/image-to-3d` is intentionally NOT a target here — the
 * UI no longer offers it (replaced by `tripo3d/h3.1/multiview-to-3d`). The
 * type union still includes it so historical job rows continue to typecheck.
 */
function buildRequest(
  model: FalModelId,
  paths: string[],
  recon: ReconOptions,
  p1: P1Options,
  h31: H31Options,
): GenerateRequest {
  switch (model) {
    case "fal-ai/reconviagen-0.5":
      return { model, input_image_paths: paths, options: recon };
    case "tripo3d/p1/image-to-3d":
      return { model, input_image_path: paths[0], options: p1 };
    case "tripo3d/h3.1/multiview-to-3d":
      return { model, input_image_paths: paths, options: h31 };
    case "tripo3d/h3.1/image-to-3d":
      // Should be unreachable from the UI, but keep the union exhaustive.
      throw new Error(
        "tripo3d/h3.1/image-to-3d is no longer offered. Use tripo3d/h3.1/multiview-to-3d.",
      );
  }
}
