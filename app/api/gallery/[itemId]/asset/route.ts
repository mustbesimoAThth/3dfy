import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { getGalleryItem } from "@/lib/gallery";
import { listJobInputs } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Signs storage URLs for assets attached to a gallery item.
 *
 * Access rules:
 *   - The caller must be authenticated.
 *   - The gallery item must be (public AND approved) OR owned by the caller.
 *
 * Implementation note: the admin client is used to actually sign the URL
 * because the underlying `models`/`inputs` buckets are keyed by the *job
 * owner's* user id — a viewer who isn't the owner would otherwise be denied
 * by storage RLS. We've already validated visibility at the row level above.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await ctx.params;
  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") ?? "glb";
  const inputIdx = Number(url.searchParams.get("inputIdx") ?? "0");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await getGalleryItem(supabase, itemId);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isOwner = item.user_id === user.id;
  const isPublicallyVisible =
    item.visibility === "public" && item.moderation === "approved";
  if (!isOwner && !isPublicallyVisible) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let bucket: "models" | "inputs";
  let path: string | null = null;

  switch (variant) {
    case "pbr":
      bucket = "models";
      path = item.job.model_pbr_glb_path;
      break;
    case "preview":
      // Special case: many jobs ship a fal preview URL that's already public.
      if (item.job.preview_image_url) {
        return NextResponse.json({ url: item.job.preview_image_url });
      }
      bucket = "inputs";
      path = item.job.input_image_path;
      break;
    case "input": {
      bucket = "inputs";
      // Prefer the ordered job_inputs rows if present.
      const inputs = await listJobInputs(createSupabaseAdminClient(), item.job.id);
      if (inputs.length > 0) {
        const row = inputs[inputIdx] ?? inputs[0];
        path = row.image_path;
      } else {
        path = item.job.input_image_path;
      }
      break;
    }
    case "glb":
    default:
      bucket = "models";
      path = item.job.model_glb_path;
      break;
  }

  if (!path) {
    return NextResponse.json({ error: "Asset not ready" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 30);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not sign url" },
      { status: 500 },
    );
  }
  return NextResponse.json({ url: data.signedUrl });
}
