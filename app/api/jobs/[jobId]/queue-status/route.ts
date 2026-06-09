import { NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

/** Pollable snapshot of fal queue state for authenticated job owners only. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await ctx.params;

  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "FAL_KEY not configured on the server." },
      { status: 500 },
    );
  }

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

  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json({
      ok: true as const,
      jobStatus: job.status,
      fal: null,
    });
  }

  if (!job.fal_request_id) {
    return NextResponse.json({
      ok: true as const,
      jobStatus: job.status,
      fal: null,
    });
  }

  try {
    const st = await fal.queue.status(job.model, {
      requestId: job.fal_request_id,
      logs: true,
    });

    if (st.status === "IN_QUEUE") {
      return NextResponse.json({
        ok: true as const,
        jobStatus: job.status,
        fal: {
          status: "IN_QUEUE" as const,
          queue_position: st.queue_position,
        },
      });
    }

    if (st.status === "IN_PROGRESS") {
      return NextResponse.json({
        ok: true as const,
        jobStatus: job.status,
        fal: {
          status: "IN_PROGRESS" as const,
          logs: st.logs?.slice(-12) ?? [],
        },
      });
    }

    // COMPLETED on fal — webhook may still be persisting the .glb
    return NextResponse.json({
      ok: true as const,
      jobStatus: job.status,
      fal: {
        status: "COMPLETED" as const,
        logs: st.logs?.slice(-12) ?? [],
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fal status failed";
    return NextResponse.json({ ok: false as const, error: message }, { status: 502 });
  }
}
