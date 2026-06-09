import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasUserLiked, likeItem, unlikeItem } from "@/lib/gallery";

export const runtime = "nodejs";

/** Toggle a like for the current user on the given gallery item. */
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
    const already = await hasUserLiked(supabase, itemId, user.id);
    if (already) {
      await unlikeItem(supabase, itemId, user.id);
      return NextResponse.json({ liked: false });
    }
    await likeItem(supabase, itemId, user.id);
    return NextResponse.json({ liked: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Like toggle failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
