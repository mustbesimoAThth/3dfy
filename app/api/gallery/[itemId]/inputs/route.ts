import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { getGalleryItem } from "@/lib/gallery";
import { listJobInputs } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Returns signed URLs for every source image of a gallery item's underlying
 * job. Visible to any authenticated viewer if the item is public+approved,
 * always visible to the owner.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const item = await getGalleryItem(supabase, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = item.user_id === user.id;
  const isPublic = item.visibility === "public" && item.moderation === "approved";
  if (!isOwner && !isPublic) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const inputs = await listJobInputs(admin, item.job.id);
  const paths =
    inputs.length > 0
      ? inputs.map((i) => i.image_path)
      : item.job.input_image_path
        ? [item.job.input_image_path]
        : [];
  if (paths.length === 0) return NextResponse.json({ urls: [] });

  const urls: string[] = [];
  for (const p of paths) {
    const { data, error } = await admin.storage
      .from("inputs")
      .createSignedUrl(p, 60 * 30);
    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not sign url" },
        { status: 500 },
      );
    }
    urls.push(data.signedUrl);
  }
  return NextResponse.json({ urls });
}
