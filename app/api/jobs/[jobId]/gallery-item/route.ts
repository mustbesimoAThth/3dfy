import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs";
import { getGalleryItemByJob } from "@/lib/gallery";

export const runtime = "nodejs";

/** Returns the gallery item linked to a job, or null. Owner-only. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const job = await getJob(supabase, jobId);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const item = await getGalleryItemByJob(supabase, jobId);
  return NextResponse.json({ item: item ?? null });
}
