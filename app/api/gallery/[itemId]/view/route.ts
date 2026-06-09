import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { incrementGalleryView } from "@/lib/gallery";

export const runtime = "nodejs";

/**
 * Bumps `gallery_items.view_count` by 1 via a SECURITY DEFINER RPC. The RPC
 * only increments for public + approved items; private/rejected items are a
 * silent no-op.
 */
export async function POST(
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
  try {
    await incrementGalleryView(supabase, itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "View increment failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
