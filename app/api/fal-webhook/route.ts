import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { pickArtifacts, type FalWebhookSuccessPayload } from "@/lib/fal";
import { verifyJobIdSignature } from "@/lib/webhook";
import { getJob, updateJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");
  const sig = url.searchParams.get("sig");
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "WEBHOOK_SECRET not configured" },
      { status: 500 },
    );
  }
  if (!jobId || !sig || !verifyJobIdSignature(jobId, sig, secret)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let body: FalWebhookSuccessPayload;
  try {
    body = (await req.json()) as FalWebhookSuccessPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const job = await getJob(admin, jobId);
  if (!job) {
    return NextResponse.json({ error: "unknown job" }, { status: 404 });
  }

  // ERROR path
  if (body.status === "ERROR" || body.error) {
    await updateJob(admin, jobId, {
      status: "failed",
      error: body.error ?? "Generation failed.",
    });
    return NextResponse.json({ ok: true });
  }

  const { glb, pbrGlb, preview } = pickArtifacts(body.payload);
  if (!glb) {
    await updateJob(admin, jobId, {
      status: "failed",
      error: "Webhook payload had no .glb url.",
    });
    return NextResponse.json({ ok: true });
  }

  // Persist the .glb (textured) and optional PBR variant into our own bucket
  // before fal's signed URLs expire.
  try {
    const glbPath = `${job.user_id}/${job.id}/model.glb`;
    await downloadAndUpload(admin, glb, glbPath, "model/gltf-binary");

    let pbrPath: string | null = null;
    if (pbrGlb && pbrGlb !== glb) {
      pbrPath = `${job.user_id}/${job.id}/pbr_model.glb`;
      try {
        await downloadAndUpload(admin, pbrGlb, pbrPath, "model/gltf-binary");
      } catch {
        // Non-fatal — we keep the main glb.
        pbrPath = null;
      }
    }

    await updateJob(admin, jobId, {
      status: "completed",
      model_glb_path: glbPath,
      model_pbr_glb_path: pbrPath,
      preview_image_url: preview,
      error: null,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to persist model.";
    await updateJob(admin, jobId, { status: "failed", error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Some configurations forward GET preflights — accept and ignore them.
export async function GET() {
  return NextResponse.json({ ok: true });
}

async function downloadAndUpload(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  url: string,
  path: string,
  contentType: string,
) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  const { error } = await admin.storage
    .from("models")
    .upload(path, arrayBuf, {
      contentType,
      upsert: true,
    });
  if (error) throw error;
}
