"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Download, Hourglass, Loader2 } from "lucide-react";
import { GenerationProgressBar } from "@/components/GenerationProgressBar";
import { ModelViewer } from "@/components/ModelViewer";
import { ShareToGalleryPanel } from "@/components/ShareToGalleryPanel";
import { tryCreateSupabaseBrowserClient } from "@/lib/supabase/client";
import { MODELS } from "@/lib/fal";
import type { JobRow } from "@/lib/types/database";
import { timeAgo } from "@/lib/utils";

export function JobDetail({ initialJob }: { initialJob: JobRow }) {
  const [job, setJob] = useState(initialJob);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [pbrUrl, setPbrUrl] = useState<string | null>(null);
  const [inputUrls, setInputUrls] = useState<string[]>([]);

  const supabase = useMemo(() => tryCreateSupabaseBrowserClient(), []);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`job-${job.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${job.id}` },
        (payload: { new: Record<string, unknown> }) =>
          setJob(payload.new as unknown as JobRow),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, job.id]);

  // Sign URLs whenever the relevant paths exist.
  useEffect(() => {
    if (!job.model_glb_path) return;
    void (async () => {
      const r = await fetch(`/api/jobs/${job.id}/asset?variant=glb`);
      if (r.ok) {
        const j = (await r.json()) as { url: string };
        setGlbUrl(j.url);
      }
    })();
  }, [job.id, job.model_glb_path]);

  useEffect(() => {
    if (!job.model_pbr_glb_path) return;
    void (async () => {
      const r = await fetch(`/api/jobs/${job.id}/asset?variant=pbr`);
      if (r.ok) {
        const j = (await r.json()) as { url: string };
        setPbrUrl(j.url);
      }
    })();
  }, [job.id, job.model_pbr_glb_path]);

  useEffect(() => {
    if (!job.input_image_path) return;
    void (async () => {
      const r = await fetch(`/api/jobs/${job.id}/inputs`);
      if (r.ok) {
        const j = (await r.json()) as { urls: string[] };
        if (j.urls.length > 0) {
          setInputUrls(j.urls);
          return;
        }
      }
      // Fallback for legacy jobs (no job_inputs rows): use the single
      // primary input via the original asset endpoint.
      const r2 = await fetch(`/api/jobs/${job.id}/asset?variant=input`);
      if (r2.ok) {
        const j2 = (await r2.json()) as { url: string };
        setInputUrls([j2.url]);
      }
    })();
  }, [job.id, job.input_image_path]);

  const model = MODELS[job.model];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/40 backdrop-blur">
        <div className="relative aspect-square w-full sm:aspect-[4/3]">
          {job.status === "completed" && glbUrl ? (
            <ModelViewer
              src={glbUrl}
              poster={job.preview_image_url ?? undefined}
              alt="Generated 3D model preview"
            />
          ) : job.status === "failed" ? (
            <div className="grid h-full w-full place-items-center text-center">
              <div className="max-w-sm space-y-2 px-6 text-destructive">
                <AlertCircle className="mx-auto h-8 w-8" />
                <p className="font-medium">Generation failed</p>
                <p className="text-sm text-destructive/80">
                  {job.error ?? "Something went wrong on the generator's side."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid h-full w-full place-items-center">
              <div className="flex flex-col items-center gap-6 text-muted-foreground">
                {job.status === "queued" ? (
                  <Hourglass className="h-7 w-7" />
                ) : (
                  <Loader2 className="h-7 w-7 animate-spin" />
                )}
                <GenerationProgressBar
                  jobId={job.id}
                  jobStatus={job.status}
                  model={job.model}
                  falRequestId={job.fal_request_id}
                  jobStartedAt={job.created_at}
                />
                <p className="max-w-[22rem] px-4 text-center text-xs opacity-90">
                  {job.status === "queued"
                    ? "Usually 30 seconds to a few minutes depending on tier and queue load."
                    : "You can leave this page — completion updates sync when you come back."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur">
          <h2 className="text-sm font-medium text-muted-foreground">Model</h2>
          <p className="mt-1 font-semibold">{model.tagline}</p>
          <p className="text-xs text-muted-foreground">{model.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="text-right capitalize">
              {job.status.replace("_", " ")}
            </dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-right">{timeAgo(job.created_at)}</dd>
            {job.fal_request_id && (
              <>
                <dt className="text-muted-foreground">Request</dt>
                <dd className="truncate text-right font-mono text-[10px]">
                  {job.fal_request_id}
                </dd>
              </>
            )}
          </dl>
        </div>

        {inputUrls.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              {inputUrls.length === 1
                ? "Source image"
                : `Source images (${inputUrls.length})`}
            </h2>
            {inputUrls.length === 1 ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={inputUrls[0]}
                alt="source"
                className="w-full rounded-lg object-contain"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {inputUrls.map((u, i) => (
                  <div
                    key={u}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-background"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={u}
                      alt={`source view ${i + 1}`}
                      className="h-full w-full object-contain"
                    />
                    <span className="absolute left-1.5 top-1.5 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {job.status === "completed" && glbUrl && (
          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              Download
            </h2>
            <div className="grid gap-2">
              <DownloadLink
                href={glbUrl}
                filename={`3dfy-${job.id}.glb`}
                label="Standard .glb"
              />
              {pbrUrl && (
                <DownloadLink
                  href={pbrUrl}
                  filename={`3dfy-${job.id}-pbr.glb`}
                  label="PBR .glb"
                />
              )}
            </div>
          </div>
        )}

        <ShareToGalleryPanel job={job} />
      </aside>
    </div>
  );
}

function DownloadLink({
  href,
  filename,
  label,
}: {
  href: string;
  filename: string;
  label: string;
}) {
  return (
    <a
      href={href}
      download={filename}
      className="inline-flex items-center justify-between rounded-xl border border-border bg-background/60 px-3 py-2 text-sm hover:bg-accent"
    >
      <span className="inline-flex items-center gap-2">
        <Download className="h-4 w-4" />
        {label}
      </span>
      <span className="text-xs text-muted-foreground">.glb</span>
    </a>
  );
}
