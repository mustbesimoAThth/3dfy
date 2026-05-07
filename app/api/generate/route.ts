import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildFalInput, fal, generateRequestSchema } from "@/lib/fal";
import { countJobsLast24h, insertJob, updateJob } from "@/lib/jobs";
import { buildWebhookUrl } from "@/lib/webhook";

export const runtime = "nodejs";

const bodySchema = generateRequestSchema;

export async function POST(req: Request) {
  if (!process.env.FAL_KEY) {
    return NextResponse.json(
      { error: "FAL_KEY not configured on the server." },
      { status: 500 },
    );
  }
  if (!process.env.WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "WEBHOOK_SECRET not configured on the server." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const request = parsed.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit
  const limit = Number(process.env.DAILY_GENERATION_LIMIT ?? "10");
  if (Number.isFinite(limit) && limit > 0) {
    const used = await countJobsLast24h(supabase, user.id);
    if (used >= limit) {
      return NextResponse.json(
        {
          error: `Daily generation limit reached (${limit}). Try again tomorrow.`,
        },
        { status: 429 },
      );
    }
  }

  // The path must live under the user's own folder (RLS).
  if (!request.input_image_path.startsWith(`${user.id}/`)) {
    return NextResponse.json(
      { error: "Image path does not belong to the current user." },
      { status: 403 },
    );
  }

  // Sign the input image so fal.ai can fetch it.
  const { data: signed, error: signErr } = await supabase.storage
    .from("inputs")
    .createSignedUrl(request.input_image_path, 60 * 30); // 30 min
  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "Could not sign input image." },
      { status: 500 },
    );
  }

  // Insert the job row first so we can include its id in the webhook URL.
  const job = await insertJob(supabase, {
    user_id: user.id,
    model: request.model,
    options: request.options,
    input_image_path: request.input_image_path,
    status: "queued",
  });

  const webhookUrl = buildWebhookUrl(job.id, process.env.WEBHOOK_SECRET);
  const input = buildFalInput(request, signed.signedUrl);

  try {
    const submit = await fal.queue.submit(request.model, {
      input,
      webhookUrl,
    });
    await updateJob(supabase, job.id, {
      fal_request_id: submit.request_id,
      status: "in_progress",
    });
    return NextResponse.json({ jobId: job.id, requestId: submit.request_id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "fal.ai submit failed";
    await updateJob(supabase, job.id, { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
