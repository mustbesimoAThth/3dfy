"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { ImageDropzone, type PreparedImage } from "@/components/ImageDropzone";
import { ModelPicker } from "@/components/ModelPicker";
import { GenerationOptions } from "@/components/GenerationOptions";
import { JobCard } from "@/components/JobCard";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  estimateCost,
  type GenerateRequest,
  type H31Options,
  type P1Options,
} from "@/lib/fal";
import type { FalModelId, JobRow } from "@/lib/types/database";

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
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [model, setModel] = useState<FalModelId>("tripo3d/p1/image-to-3d");
  const [p1, setP1] = useState<P1Options>({ texture: true });
  const [h31, setH31] = useState<H31Options>({
    texture: "standard",
    detailed_geometry: false,
    quad: false,
    pbr: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // Realtime updates on this user's jobs.
  useEffect(() => {
    const channel = supabase
      .channel(`jobs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs", filter: `user_id=eq.${userId}` },
        (payload) => {
          setJobs((prev) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as JobRow;
              if (prev.some((j) => j.id === row.id)) return prev;
              return [row, ...prev].slice(0, 48);
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as JobRow;
              return prev.map((j) => (j.id === row.id ? row : j));
            }
            if (payload.eventType === "DELETE") {
              const row = payload.old as JobRow;
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

  const request: GenerateRequest =
    model === "tripo3d/p1/image-to-3d"
      ? { model, input_image_path: "", options: p1 }
      : { model, input_image_path: "", options: h31 };

  const cost = estimateCost(request);

  async function onGenerate() {
    if (!image || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const ext = (image.filename.split(".").pop() || "webp").toLowerCase();
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("inputs")
        .upload(path, image.blob, {
          contentType: image.blob.type || "image/webp",
          upsert: false,
        });
      if (upErr) throw upErr;

      const body =
        model === "tripo3d/p1/image-to-3d"
          ? { model, input_image_path: path, options: p1 }
          : { model, input_image_path: path, options: h31 };

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
      // Reset image, keep options.
      URL.revokeObjectURL(image.previewUrl);
      setImage(null);
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

        <ImageDropzone
          value={image}
          onChange={setImage}
          disabled={submitting}
        />

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
            p1={p1}
            h31={h31}
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

        <div className="sticky bottom-4 z-10 flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 p-3 backdrop-blur">
          <div className="text-xs text-muted-foreground">
            Estimated cost{" "}
            <span className="font-medium text-foreground">
              ${cost.toFixed(2)}
            </span>
          </div>
          <button
            type="button"
            disabled={!image || submitting}
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-50"
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
