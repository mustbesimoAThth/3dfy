"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Heart,
  Loader2,
  MessageCircle,
  Share2,
  Trash2,
} from "lucide-react";
import type {
  GalleryItemRow,
  GalleryVisibility,
  JobRow,
} from "@/lib/types/database";

type Mode = "loading" | "share" | "manage";

/**
 * Panel embedded on the job detail page. When the underlying job has no
 * gallery item yet it shows a "Share to gallery" form; otherwise it shows
 * the live counters, lets the owner edit title/description, flip visibility,
 * or remove the item from the gallery.
 *
 * Visibility is the live "state across the company" — flipping it to private
 * keeps the row + stats but hides the piece from /gallery.
 */
export function ShareToGalleryPanel({ job }: { job: JobRow }) {
  const [mode, setMode] = useState<Mode>("loading");
  const [item, setItem] = useState<GalleryItemRow | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<GalleryVisibility>("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Probe for an existing gallery item linked to this job so we can render
  // either the "Share to gallery" form or the live "Manage" panel from the
  // first paint. 404/404-ish responses fall through to the share flow.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await fetch(`/api/jobs/${job.id}/gallery-item`);
      if (cancelled) return;
      if (r.ok) {
        const j = (await r.json()) as { item: GalleryItemRow | null };
        if (j.item) {
          setItem(j.item);
          setTitle(j.item.title);
          setDescription(j.item.description);
          setVisibility(j.item.visibility);
          setMode("manage");
          return;
        }
      }
      setTitle(`Creation · ${new Date(job.created_at).toLocaleDateString()}`);
      setMode("share");
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, job.created_at]);

  async function onShare() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await fetch("/api/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id: job.id,
        title: title.trim() || "Untitled",
        description: description.trim(),
        visibility,
      }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      item?: GalleryItemRow;
      itemId?: string;
      error?: string;
    };
    if (r.status === 409 && j.itemId) {
      // Already shared — load it.
      await loadItem(j.itemId);
    } else if (r.ok && j.item) {
      setItem(j.item);
      setTitle(j.item.title);
      setDescription(j.item.description);
      setVisibility(j.item.visibility);
      setMode("manage");
    } else {
      setError(j.error ?? `Failed (${r.status})`);
    }
    setBusy(false);
  }

  async function loadItem(itemId: string) {
    const r = await fetch(`/api/gallery/${itemId}`);
    if (r.ok) {
      const j = (await r.json()) as { item: GalleryItemRow };
      setItem(j.item);
      setTitle(j.item.title);
      setDescription(j.item.description);
      setVisibility(j.item.visibility);
      setMode("manage");
    }
  }

  async function onSave() {
    if (!item || busy) return;
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/gallery/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim() || "Untitled",
        description: description.trim(),
        visibility,
      }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      item?: GalleryItemRow;
      error?: string;
    };
    if (r.ok && j.item) {
      setItem(j.item);
    } else {
      setError(j.error ?? `Failed (${r.status})`);
    }
    setBusy(false);
  }

  async function onUnshare() {
    if (!item || busy) return;
    if (!confirm("Remove this creation from the gallery? Likes and comments will be lost.")) return;
    setBusy(true);
    const r = await fetch(`/api/gallery/${item.id}`, { method: "DELETE" });
    if (r.ok) {
      setItem(null);
      setMode("share");
      setTitle(`Creation · ${new Date(job.created_at).toLocaleDateString()}`);
      setDescription("");
      setVisibility("public");
    } else {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `Failed (${r.status})`);
    }
    setBusy(false);
  }

  if (job.status !== "completed" || !job.model_glb_path) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Share2 className="h-4 w-4" />
        Gallery
      </h2>

      {mode === "loading" && (
        <div className="mt-3 grid place-items-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {mode === "share" && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Share this model with everyone on 3dfy. You can flip visibility or
            remove it at any time.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Title"
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Description (optional)"
            className="w-full resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <VisibilityToggle value={visibility} onChange={setVisibility} />
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onShare}
            disabled={busy || !title.trim()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Share to gallery
          </button>
        </div>
      )}

      {mode === "manage" && item && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {item.like_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {item.comment_count}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {item.view_count}
            </span>
            <Link
              href={`/gallery/${item.id}`}
              className="ml-auto inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
            >
              Open <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Title"
            className="w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Description (optional)"
            className="w-full resize-none rounded-lg border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
          <VisibilityToggle value={visibility} onChange={setVisibility} />
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </button>
            <button
              type="button"
              onClick={onUnshare}
              disabled={busy}
              title="Remove from gallery"
              className="inline-flex items-center justify-center rounded-full border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VisibilityToggle({
  value,
  onChange,
}: {
  value: GalleryVisibility;
  onChange: (v: GalleryVisibility) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Visibility"
      className="grid grid-cols-2 gap-2 rounded-full border border-border bg-background/40 p-1 text-xs"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "public"}
        onClick={() => onChange("public")}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition ${
          value === "public"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Eye className="h-3.5 w-3.5" />
        Public
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "private"}
        onClick={() => onChange("private")}
        className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition ${
          value === "private"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <EyeOff className="h-3.5 w-3.5" />
        Unlisted
      </button>
    </div>
  );
}
