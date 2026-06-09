import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getJob, listJobInputs } from "@/lib/jobs";

export const runtime = "nodejs";

/**
 * Returns signed URLs for every input image of a job, in display order.
 *
 * Falls back to the legacy single-image `jobs.input_image_path` when no
 * `job_inputs` rows exist (jobs created before migration 0004).
 */
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

  const inputs = await listJobInputs(supabase, jobId);
  const paths =
    inputs.length > 0
      ? inputs.map((i) => i.image_path)
      : job.input_image_path
        ? [job.input_image_path]
        : [];

  if (paths.length === 0) {
    return NextResponse.json({ urls: [] });
  }

  const urls: string[] = [];
  for (const p of paths) {
    const { data, error } = await supabase.storage
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
