"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FalModelId, JobStatus } from "@/lib/types/database";
import { formatElapsed } from "@/lib/utils";

/** Soft target for the “rising” segment — fal often runs longer than this. */
const MODEL_ETA_MS: Record<FalModelId, number> = {
  "fal-ai/reconviagen-0.5": 210_000,
  "tripo3d/p1/image-to-3d": 95_000,
  "tripo3d/h3.1/image-to-3d": 140_000,
  "tripo3d/h3.1/multiview-to-3d": 160_000,
};

/**
 * Time-based asymptotic curve: pct = 95 · (1 − e^(−t/ETA · k)).
 * Always strictly increases, asymptotes below 95, never locks at one value.
 * We deliberately do NOT use sub-stage tqdm "100%" lines from fal logs as
 * overall progress — those describe one phase (sampling, voxelization, etc.)
 * and would pin the bar at the first phase's completion percentage.
 */
function inProgressPercent(
  elapsedMs: number,
  etaMs: number,
): { pct: number; overEta: boolean } {
  const k = 1.2;
  const ratio = elapsedMs / Math.max(1, etaMs);
  const raw = 30 + 65 * (1 - Math.exp(-ratio * k));
  return {
    pct: Math.max(30, Math.min(94, Math.round(raw))),
    overEta: elapsedMs > etaMs,
  };
}

export type FalQueueSnapshot =
  | { status: "IN_QUEUE"; queue_position: number }
  | { status: "IN_PROGRESS"; logs: { message: string }[] }
  | { status: "COMPLETED"; logs: { message: string }[] };

function queuePercent(position: number): number {
  if (position <= 1) return 28;
  const p = 12 + Math.min(16, (16 / position) * 4);
  return Math.round(Math.min(32, p));
}

export function GenerationProgressBar({
  jobId,
  jobStatus,
  model,
  falRequestId,
  jobStartedAt,
}: {
  jobId: string;
  jobStatus: JobStatus;
  model: FalModelId;
  falRequestId: string | null;
  /** Job row `created_at` — wall-clock elapsed for the whole run (queue + generation). */
  jobStartedAt: string;
}) {
  const [snapshot, setSnapshot] = useState<FalQueueSnapshot | null>(null);
  const [pollError, setPollError] = useState(false);
  const [inProgressElapsedMs, setInProgressElapsedMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const inProgressStartedRef = useRef<number | null>(null);
  // Mirror of `snapshot` so the polling loop can read the latest status
  // without depending on it (which would re-create the interval each tick).
  const snapshotRef = useRef<FalQueueSnapshot | null>(null);

  const active = jobStatus === "queued" || jobStatus === "in_progress";

  const jobStartTime = useMemo(() => new Date(jobStartedAt).getTime(), [jobStartedAt]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  // Adaptive polling for cosmetic queue position.
  // Job completion itself arrives via the Supabase Realtime subscription on
  // the parent page, so this loop is intentionally relaxed — rates below are
  // tuned to keep Vercel function invocations & cost low.
  //
  //   IN_QUEUE     →  6 s
  //   IN_PROGRESS  → 12 s   (the queue position no longer changes)
  //   error        →  exponential back-off 8 → 16 → 30 s (capped)
  //   tab hidden   →  pause completely; one fresh poll on re-focus
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let timeoutId: number | null = null;
    let errorStreak = 0;

    function nextDelayMs(): number {
      if (errorStreak > 0) {
        const backoff = Math.min(8000 * 2 ** (errorStreak - 1), 30_000);
        return backoff;
      }
      if (snapshotRef.current?.status === "IN_PROGRESS") return 12_000;
      return 6_000;
    }

    async function poll() {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) {
        schedule();
        return;
      }
      try {
        const r = await fetch(`/api/jobs/${jobId}/queue-status`);
        const json = (await r.json()) as
          | { ok: true; fal: FalQueueSnapshot | null; jobStatus?: JobStatus }
          | { ok: false; error?: string };

        if (cancelled) return;
        if (!r.ok || !("ok" in json) || json.ok !== true) {
          errorStreak += 1;
          setPollError(true);
        } else {
          errorStreak = 0;
          setPollError(false);
          setSnapshot(json.fal);
          snapshotRef.current = json.fal;
        }
      } catch {
        if (!cancelled) {
          errorStreak += 1;
          setPollError(true);
        }
      } finally {
        schedule();
      }
    }

    function schedule() {
      if (cancelled) return;
      timeoutId = window.setTimeout(() => void poll(), nextDelayMs());
    }

    function onVisibility() {
      if (cancelled) return;
      if (!document.hidden) {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        void poll();
      }
    }

    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active, jobId]);

  useEffect(() => {
    if (snapshot?.status === "IN_PROGRESS") {
      if (inProgressStartedRef.current === null) {
        inProgressStartedRef.current = Date.now();
      }
    } else if (snapshot?.status === "IN_QUEUE" || snapshot === null) {
      inProgressStartedRef.current = null;
    }
  }, [snapshot]);

  useEffect(() => {
    if (!active || snapshot?.status !== "IN_PROGRESS") {
      setInProgressElapsedMs(0);
      return;
    }
    function update() {
      if (inProgressStartedRef.current) {
        setInProgressElapsedMs(Date.now() - inProgressStartedRef.current);
      }
    }
    update();
    const id = window.setInterval(update, 900);
    return () => window.clearInterval(id);
  }, [active, snapshot?.status]);

  const etaMs = MODEL_ETA_MS[model];

  const inProgressDerived = useMemo(() => {
    if (snapshot?.status !== "IN_PROGRESS") return null;
    const elapsed =
      inProgressElapsedMs ||
      (inProgressStartedRef.current !== null
        ? Date.now() - inProgressStartedRef.current
        : 0);
    const { pct, overEta } = inProgressPercent(elapsed, etaMs);
    const lastMsg =
      snapshot.logs
        ?.filter((l) => l.message.trim())
        .at(-1)
        ?.message.trim() ?? "";

    const typicalSec = Math.round(etaMs / 1000);
    let sublabel = lastMsg
      ? lastMsg.slice(0, 140)
      : `Typical runs are around ${typicalSec}s; the bar keeps moving while the generator works.`;

    if (overEta && !lastMsg) {
      sublabel = `Past the usual ~${typicalSec}s — busy queues or heavy options often need more time. Still running…`;
    } else if (overEta && lastMsg) {
      sublabel = `${lastMsg.slice(0, 110)} · taking longer than the usual ~${typicalSec}s is normal when load is high.`;
    }

    return { pct, sublabel, longTailVisual: overEta };
  }, [snapshot, etaMs, inProgressElapsedMs]);

  let label = "";
  let sublabel = "";
  let displayPct: number | null = null;
  let longTailProgress = false;

  if (active) {
    if (!falRequestId) {
      label = "Starting…";
      sublabel =
        jobStatus === "queued"
          ? "Queued on our side."
          : "Connecting to the generator…";
      displayPct = null;
    } else if (snapshot === null) {
      label = pollError ? "Waiting for the generator…" : "Checking queue…";
      sublabel = pollError
        ? "Live status is temporarily unavailable — the run continues in the background."
        : "Fetching live queue status.";
      displayPct = null;
    } else if (snapshot.status === "IN_QUEUE") {
      const pos = snapshot.queue_position;
      label = "In the generation queue";
      sublabel =
        pos <= 1
          ? "You are next — should start shortly."
          : `Position ${pos}. We move forward as workers free up.`;
      displayPct = queuePercent(pos);
    } else if (snapshot.status === "IN_PROGRESS") {
      label = "Generating mesh & textures";
      if (inProgressDerived) {
        sublabel = inProgressDerived.sublabel;
        displayPct = inProgressDerived.pct;
        longTailProgress = inProgressDerived.longTailVisual;
      } else {
        sublabel = "";
        displayPct = 36;
      }
    } else {
      const lastLog = snapshot.logs?.filter((l) => l.message.trim())?.at(-1);
      label = "Almost done";
      sublabel =
        lastLog?.message.slice(0, 140) ??
        "Inference finished — saving your .glb to storage.";
      displayPct = 96;
    }
  }

  const runningLabel = Number.isFinite(jobStartTime)
    ? formatElapsed(nowMs - jobStartTime)
    : "…";

  if (!active) return null;

  return (
    <div className="w-full max-w-sm space-y-2 px-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 text-xs tabular-nums text-muted-foreground">
          <div className="font-medium uppercase tracking-wide">Progress</div>
          <div className="mt-1 text-muted-foreground/95">
            Running{" "}
            <span
              className="font-medium text-foreground"
              aria-live="polite"
              aria-atomic="true"
            >
              {runningLabel}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right tabular-nums">
          {typeof displayPct === "number" ? (
            <span className="text-sm font-semibold text-foreground">{displayPct}%</span>
          ) : (
            <span className="text-sm text-muted-foreground" aria-hidden>
              …
            </span>
          )}
        </div>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        {...(typeof displayPct === "number"
          ? { "aria-valuenow": displayPct }
          : { "aria-valuetext": "In progress" })}
        className="h-2.5 overflow-hidden rounded-full bg-muted shadow-inner"
      >
        <div
          className={`h-full rounded-full bg-gradient-to-r from-primary/80 via-primary to-primary/90 transition-[width] duration-700 ease-out ${
            displayPct === null
              ? "motion-safe:animate-pulse"
              : longTailProgress
                ? "motion-safe:animate-pulse opacity-95"
                : ""
          }`}
          style={
            typeof displayPct === "number"
              ? { width: `${displayPct}%` }
              : { width: "42%" }
          }
        />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}
