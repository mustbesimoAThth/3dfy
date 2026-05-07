"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2, Hourglass, Loader2 } from "lucide-react";
import type { JobRow } from "@/lib/types/database";
import { MODELS } from "@/lib/fal";
import { timeAgo } from "@/lib/utils";

export function JobCard({
  job,
  previewUrl,
}: {
  job: JobRow;
  previewUrl?: string | null;
}) {
  const model = MODELS[job.model];
  return (
    <Link
      href={`/app/${job.id}`}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 backdrop-blur transition hover:border-primary/50"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground">
            <StatusIcon status={job.status} />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium backdrop-blur">
          <StatusIcon status={job.status} className="h-3 w-3" />
          {job.status.replace("_", " ")}
        </span>
      </div>
      <div className="flex items-center justify-between p-3 text-xs">
        <span className="font-medium">{model.name}</span>
        <span className="text-muted-foreground">{timeAgo(job.created_at)}</span>
      </div>
    </Link>
  );
}

function StatusIcon({
  status,
  className = "h-4 w-4",
}: {
  status: JobRow["status"];
  className?: string;
}) {
  switch (status) {
    case "queued":
      return <Hourglass className={className} />;
    case "in_progress":
      return <Loader2 className={`${className} animate-spin`} />;
    case "completed":
      return <CheckCircle2 className={className} />;
    case "failed":
      return <AlertCircle className={className} />;
  }
}
