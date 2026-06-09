"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Heart, Loader2, MessageCircle, Trash2 } from "lucide-react";
import { ModelViewer } from "@/components/ModelViewer";
import { MODELS } from "@/lib/fal";
import { tryCreateSupabaseBrowserClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/utils";
import type { GalleryItemWithRels } from "@/lib/gallery";
import type { GalleryCommentRow, ProfileRow } from "@/lib/types/database";

type CommentWithAuthor = GalleryCommentRow & {
  author: Pick<ProfileRow, "id" | "display_name">;
};

export function GalleryDetail({
  initialItem,
  initialLiked,
  viewerId,
}: {
  initialItem: GalleryItemWithRels;
  initialLiked: boolean;
  viewerId: string;
}) {
  const [item, setItem] = useState(initialItem);
  const [liked, setLiked] = useState(initialLiked);
  const [likeBusy, setLikeBusy] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [glbUrl, setGlbUrl] = useState<string | null>(null);
  const [inputUrls, setInputUrls] = useState<string[]>([]);

  const supabase = useMemo(() => tryCreateSupabaseBrowserClient(), []);
  const model = MODELS[item.job.model];

  // Bump the view counter on mount (own views included; the RPC is no-op for
  // private items so unlisted self-views won't inflate the public number).
  useEffect(() => {
    void fetch(`/api/gallery/${item.id}/view`, { method: "POST" }).catch(() => {});
  }, [item.id]);

  // Load assets.
  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/gallery/${item.id}/asset?variant=glb`);
      if (r.ok) {
        const j = (await r.json()) as { url: string };
        setGlbUrl(j.url);
      }
    })();
  }, [item.id]);

  useEffect(() => {
    void (async () => {
      const r = await fetch(`/api/gallery/${item.id}/inputs`);
      if (r.ok) {
        const j = (await r.json()) as { urls: string[] };
        setInputUrls(j.urls);
      }
    })();
  }, [item.id]);

  // Load comments.
  const refreshComments = useCallback(async () => {
    const r = await fetch(`/api/gallery/${item.id}/comments`);
    if (r.ok) {
      const j = (await r.json()) as { comments: CommentWithAuthor[] };
      setComments(j.comments);
    }
  }, [item.id]);

  useEffect(() => {
    void refreshComments();
  }, [refreshComments]);

  // Realtime: re-fetch item row when counters change.
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`gallery-${item.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "gallery_items",
          filter: `id=eq.${item.id}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setItem((prev) => ({
            ...prev,
            ...(payload.new as Partial<GalleryItemWithRels>),
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "gallery_comments",
          filter: `gallery_item_id=eq.${item.id}`,
        },
        () => {
          void refreshComments();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, item.id, refreshComments]);

  async function onToggleLike() {
    if (likeBusy) return;
    setLikeBusy(true);
    // Optimistic update.
    const prevLiked = liked;
    setLiked(!prevLiked);
    setItem((it) => ({
      ...it,
      like_count: Math.max(0, it.like_count + (prevLiked ? -1 : 1)),
    }));
    const r = await fetch(`/api/gallery/${item.id}/like`, { method: "POST" });
    if (!r.ok) {
      // Roll back.
      setLiked(prevLiked);
      setItem((it) => ({
        ...it,
        like_count: Math.max(0, it.like_count + (prevLiked ? 1 : -1)),
      }));
    } else {
      const j = (await r.json()) as { liked: boolean };
      setLiked(j.liked);
    }
    setLikeBusy(false);
  }

  async function onSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    const body = commentDraft.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true);
    const r = await fetch(`/api/gallery/${item.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (r.ok) {
      setCommentDraft("");
      await refreshComments();
    }
    setCommentBusy(false);
  }

  async function onDeleteComment(id: string) {
    const r = await fetch(
      `/api/gallery/${item.id}/comments?commentId=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (r.ok) await refreshComments();
  }

  const isOwner = item.user_id === viewerId;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/40 backdrop-blur">
          <div className="relative aspect-square w-full sm:aspect-[4/3]">
            {glbUrl ? (
              <ModelViewer
                src={glbUrl}
                poster={item.job.preview_image_url ?? undefined}
                alt={item.title}
              />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
          <p className="text-sm text-muted-foreground">
            by{" "}
            <span className="font-medium text-foreground">
              {item.author?.display_name ?? "creator"}
            </span>{" "}
            · {timeAgo(item.created_at)}
            {item.visibility === "private" && (
              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                unlisted
              </span>
            )}
          </p>
          {item.description && (
            <p className="whitespace-pre-wrap pt-2 text-sm">{item.description}</p>
          )}
        </header>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={onToggleLike}
            disabled={likeBusy || item.visibility !== "public"}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 transition hover:bg-accent disabled:opacity-50"
            aria-pressed={liked}
            title={liked ? "Unlike" : "Like"}
          >
            <Heart
              className={`h-4 w-4 ${liked ? "fill-red-500 text-red-500" : ""}`}
            />
            <span className="font-medium">{item.like_count}</span>
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span className="font-medium">{item.comment_count}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-muted-foreground">
            <Eye className="h-4 w-4" />
            <span className="font-medium">{item.view_count}</span>
          </span>
        </div>

        <section id="comments" className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Comments</h2>
          {item.visibility === "public" ? (
            <form onSubmit={onSubmitComment} className="space-y-2">
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Say something nice…"
                className="w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={!commentDraft.trim() || commentBusy}
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {commentBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Post
                </button>
              </div>
            </form>
          ) : (
            <p className="rounded-xl border border-dashed border-border/60 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              Comments are disabled while this piece is unlisted.
            </p>
          )}

          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const canDelete = c.user_id === viewerId || isOwner;
                return (
                  <li
                    key={c.id}
                    className="rounded-2xl border border-border/60 bg-background/40 p-3 backdrop-blur"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium">
                        {c.author?.display_name ?? "creator"}{" "}
                        <span className="font-normal text-muted-foreground">
                          · {timeAgo(c.created_at)}
                        </span>
                      </p>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDeleteComment(c.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur">
          <h2 className="text-sm font-medium text-muted-foreground">Model</h2>
          <p className="mt-1 font-semibold">{model.tagline}</p>
          <p className="text-xs text-muted-foreground">{model.description}</p>
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
      </aside>
    </div>
  );
}
