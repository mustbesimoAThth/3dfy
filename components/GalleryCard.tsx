"use client";

import Link from "next/link";
import { Eye, Heart, MessageCircle } from "lucide-react";
import type { GalleryItemWithRels } from "@/lib/gallery";
import { timeAgo } from "@/lib/utils";

export function GalleryCard({
  item,
  previewUrl,
}: {
  item: GalleryItemWithRels;
  previewUrl: string | null;
}) {
  return (
    <Link
      href={`/gallery/${item.id}`}
      className="group relative overflow-hidden rounded-2xl border border-border/60 bg-background/40 backdrop-blur transition hover:border-primary/50"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={item.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
            no preview
          </div>
        )}
        {item.visibility === "private" && (
          <span className="absolute right-2 top-2 rounded-full bg-background/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground backdrop-blur">
            unlisted
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-1 text-sm font-medium">{item.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          by {item.author?.display_name ?? "creator"} · {timeAgo(item.created_at)}
        </p>
        <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {item.like_count}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {item.comment_count}
          </span>
          <span className="ml-auto inline-flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {item.view_count}
          </span>
        </div>
      </div>
    </Link>
  );
}
