import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getGalleryItem, hasUserLiked } from "@/lib/gallery";
import { GalleryDetail } from "./gallery-detail";

export const dynamic = "force-dynamic";

export default async function GalleryItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/gate?next=/gallery/${itemId}`);

  let item;
  try {
    item = await getGalleryItem(supabase, itemId);
  } catch (err) {
    console.error("[gallery] detail fetch failed:", err);
    const asObj =
      err && typeof err === "object" ? (err as Record<string, unknown>) : null;
    const message =
      asObj?.message
        ? String(asObj.message)
        : err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err);
    return (
      <main className="container mx-auto max-w-xl px-4 py-10">
        <Link
          href="/gallery"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to gallery
        </Link>
        <div className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
          <p className="font-medium">This piece couldn&apos;t be loaded.</p>
          <p className="break-all font-mono text-xs text-destructive/80">
            {message}
          </p>
        </div>
      </main>
    );
  }

  if (!item) notFound();

  // RLS already enforces visibility — but if for some reason a private
  // non-owner row leaks through, render as not-found.
  const isOwner = item.user_id === user.id;
  const isPublic = item.visibility === "public" && item.moderation === "approved";
  if (!isOwner && !isPublic) notFound();

  const liked = await hasUserLiked(supabase, item.id, user.id);

  return (
    <main className="container mx-auto px-4 py-6">
      <Link
        href="/gallery"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to gallery
      </Link>
      <GalleryDetail
        initialItem={item}
        initialLiked={liked}
        viewerId={user.id}
      />
    </main>
  );
}
