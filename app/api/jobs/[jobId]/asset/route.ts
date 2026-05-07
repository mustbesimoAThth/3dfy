import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;
  const url = new URL(req.url);
  const variant = url.searchParams.get("variant") ?? "glb"; // 'glb' | 'pbr' | 'input'

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

  let bucket: "models" | "inputs";
  let path: string | null;
  switch (variant) {
    case "pbr":
      bucket = "models";
      path = job.model_pbr_glb_path;
      break;
    case "input":
      bucket = "inputs";
      path = job.input_image_path;
      break;
    case "glb":
    default:
      bucket = "models";
      path = job.model_glb_path;
      break;
  }

  if (!path) {
    return NextResponse.json({ error: "Asset not ready" }, { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 30); // 30 min
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not sign url" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl });
}
