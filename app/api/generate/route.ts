import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildFalInput,
  fal,
  generateRequestSchema,
  getRequestImagePaths,
} from "@/lib/fal";
import {
  countJobsLast24h,
  insertJob,
  insertJobInputs,
  updateJob,
} from "@/lib/jobs";
import type { JobRow } from "@/lib/types/database";
import { buildWebhookUrl } from "@/lib/webhook";

export const runtime = "nodejs";

function isDbCheckViolation(e: unknown): e is { code: string; message?: string } {
  if (typeof e !== "object" || e === null || !("code" in e)) return false;
  return String((e as { code: unknown }).code) === "23514";
}

/** Best-effort message extraction for PostgREST / pg / Error / unknown shapes. */
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    return String((e as { message: unknown }).message ?? "");
  }
  return String(e);
}

/**
 * True when the error indicates a referenced table is unknown to the database
 * or to PostgREST's schema cache. Covers:
 *   - Postgres 42P01: "relation \"public.foo\" does not exist"
 *   - PostgREST PGRST205: "Could not find the table 'public.foo' in the schema cache"
 *   - Generic message fallback (defensive).
 */
function isMissingTableError(e: unknown, table: string): boolean {
  const code =
    typeof e === "object" && e !== null && "code" in e
      ? String((e as { code: unknown }).code)
      : "";
  if (code === "42P01" || code === "PGRST205") return true;
  const msg = errorMessage(e);
  if (new RegExp(`relation .*${table}.* does not exist`, "i").test(msg)) {
    return true;
  }
  if (new RegExp(`could not find the table .*${table}.*`, "i").test(msg)) {
    return true;
  }
  return false;
}

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

  // Rate limit (one generation = one job, regardless of input count).
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

  // All input paths must live under the user's own folder (RLS).
  const imagePaths = getRequestImagePaths(request);
  for (const p of imagePaths) {
    if (!p.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "Image path does not belong to the current user." },
        { status: 403 },
      );
    }
  }

  // Sign each input image so the generator can fetch it.
  const signedUrls: string[] = [];
  for (const p of imagePaths) {
    const { data: signed, error: signErr } = await supabase.storage
      .from("inputs")
      .createSignedUrl(p, 60 * 30); // 30 min
    if (signErr || !signed) {
      return NextResponse.json(
        { error: signErr?.message ?? "Could not sign input image." },
        { status: 500 },
      );
    }
    signedUrls.push(signed.signedUrl);
  }

  // Insert the job row first so we can include its id in the webhook URL.
  // `input_image_path` keeps the primary (first) image for back-compat with
  // the recent-jobs grid and the asset?variant=input endpoint.
  let job: JobRow;
  try {
    job = await insertJob(supabase, {
      user_id: user.id,
      model: request.model,
      options: request.options,
      input_image_path: imagePaths[0],
      status: "queued",
    });
  } catch (e) {
    if (
      isDbCheckViolation(e) &&
      String((e as { message?: string }).message ?? "").includes(
        "jobs_model_check",
      )
    ) {
      // Map the model the user actually picked to the migration that adds it
      // to the `jobs_model_check` constraint. 0006 is a superset of 0002, so
      // running 0006 alone covers every supported model id.
      const migrationByModel: Record<string, string> = {
        "fal-ai/reconviagen-0.5":
          "supabase/migrations/0002_jobs_model_recon.sql (or 0006 which supersedes it)",
        "tripo3d/h3.1/multiview-to-3d":
          "supabase/migrations/0006_jobs_model_h31_multiview.sql",
      };
      const hint =
        migrationByModel[request.model] ??
        "supabase/migrations/0006_jobs_model_h31_multiview.sql";
      return NextResponse.json(
        {
          error:
            `Your DB doesn't allow model "${request.model}" yet. Open Supabase → SQL editor and run ${hint} to update jobs_model_check. ` +
            `You can verify with: select pg_get_constraintdef(oid) from pg_constraint where conname = 'jobs_model_check';`,
        },
        { status: 503 },
      );
    }
    throw e;
  }

  // Persist all input image references in `job_inputs` so the detail page
  // can render every view. If this fails we MUST mark the job as failed —
  // otherwise it sits at status='queued' forever (never sent to fal, never
  // gets a webhook), which presents to the user as a stuck generation.
  try {
    await insertJobInputs(supabase, job.id, user.id, imagePaths);
  } catch (e) {
    const msg = errorMessage(e) || "Failed to persist job inputs.";
    await updateJob(supabase, job.id, { status: "failed", error: msg });

    if (isMissingTableError(e, "job_inputs")) {
      return NextResponse.json(
        {
          error:
            "Database schema is missing the job_inputs table. Open Supabase → SQL editor and run supabase/migrations/0004_job_inputs.sql. " +
            "If you just ran it and still see this, run `notify pgrst, 'reload schema';` to refresh PostgREST's cache.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: `Could not persist job inputs: ${msg}` },
      { status: 500 },
    );
  }

  const webhookUrl = buildWebhookUrl(job.id, process.env.WEBHOOK_SECRET);
  const input = buildFalInput(request, signedUrls);

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
    const message = e instanceof Error ? e.message : "Generation request failed";
    await updateJob(supabase, job.id, { status: "failed", error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
