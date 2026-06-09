import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  GALLERY_PAGE_SIZE,
  listPublicGallery,
  type GalleryItemWithRels,
} from "@/lib/gallery";
import { GalleryCard } from "@/components/GalleryCard";

export const dynamic = "force-dynamic";

interface GalleryFault {
  message: string;
  hint?: string;
}

function describeFault(err: unknown): GalleryFault {
  // Supabase throws PostgrestError-shaped plain objects (not Error
  // instances), so `String(err)` would give "[object Object]". Pull
  // useful fields off whatever we got.
  const asObj =
    err && typeof err === "object" ? (err as Record<string, unknown>) : null;
  const parts: string[] = [];
  if (asObj?.message) parts.push(String(asObj.message));
  if (asObj?.details) parts.push(`details: ${String(asObj.details)}`);
  if (asObj?.hint) parts.push(`hint: ${String(asObj.hint)}`);
  if (asObj?.code) parts.push(`code: ${String(asObj.code)}`);
  const message =
    parts.length > 0
      ? parts.join(" · ")
      : err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : JSON.stringify(err);
  const code = asObj?.code ? String(asObj.code) : undefined;
  if (code === "42P01" || /relation .* does not exist/i.test(message)) {
    return {
      message,
      hint: "The gallery tables aren't installed yet. Open Supabase → SQL editor and run `supabase/migrations/0005_gallery.sql`.",
    };
  }
  if (code === "42703" || /column .* does not exist/i.test(message)) {
    return {
      message,
      hint: "A required column is missing. Re-run `supabase/migrations/0005_gallery.sql` from the top — the previous run was likely partial.",
    };
  }
  if (
    code === "42501" ||
    /permission denied|row-level security/i.test(message)
  ) {
    return {
      message,
      hint: "RLS rejected the read. Confirm the policies in `0005_gallery.sql` are present and that you're signed in.",
    };
  }
  if (/Missing environment variable: SUPABASE_SERVICE_ROLE_KEY/i.test(message)) {
    return {
      message,
      hint: "`SUPABASE_SERVICE_ROLE_KEY` isn't set for this environment in Vercel → Settings → Environment Variables.",
    };
  }
  return { message };
}

async function signPreviews(
  items: GalleryItemWithRels[],
): Promise<Record<string, string | null>> {
  if (items.length === 0) return {};
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    console.error("[gallery] admin client init failed:", err);
    return {};
  }
  const result: Record<string, string | null> = {};

  await Promise.all(
    items.map(async (it) => {
      try {
        if (it.job?.preview_image_url) {
          result[it.id] = it.job.preview_image_url;
          return;
        }
        if (it.job?.input_image_path) {
          const { data } = await admin.storage
            .from("inputs")
            .createSignedUrl(it.job.input_image_path, 60 * 30);
          result[it.id] = data?.signedUrl ?? null;
          return;
        }
        result[it.id] = null;
      } catch (err) {
        console.error("[gallery] preview sign failed for", it.id, err);
        result[it.id] = null;
      }
    }),
  );

  return result;
}

export default async function GalleryFeedPage() {
  const supabase = await createSupabaseServerClient();

  let items: GalleryItemWithRels[] = [];
  let fault: GalleryFault | null = null;
  try {
    items = await listPublicGallery(supabase, { limit: GALLERY_PAGE_SIZE });
  } catch (err) {
    console.error("[gallery] listPublicGallery failed:", err);
    fault = describeFault(err);
  }

  const previews = fault ? {} : await signPreviews(items);

  return (
    <main className="container mx-auto px-4 py-6">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to studio
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Community gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Models shared by everyone on 3dfy. Open a piece to like, comment, and
          download its source assets.
        </p>
      </header>

      {fault ? (
        <div className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Gallery is unavailable.</p>
              {fault.hint && (
                <p className="text-destructive/90">{fault.hint}</p>
              )}
              <p className="break-all font-mono text-xs text-destructive/80">
                {fault.message}
              </p>
            </div>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-background/40 p-10 text-center text-sm text-muted-foreground backdrop-blur">
          Nothing shared yet. Open one of your completed jobs and hit{" "}
          <span className="font-medium text-foreground">Share to gallery</span>{" "}
          to be the first.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it) => (
            <GalleryCard
              key={it.id}
              item={it}
              previewUrl={previews[it.id] ?? null}
            />
          ))}
        </div>
      )}
    </main>
  );
}
