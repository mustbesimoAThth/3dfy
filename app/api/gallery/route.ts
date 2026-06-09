import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs";
import {
  GALLERY_PAGE_SIZE,
  createGalleryItem,
  getGalleryItemByJob,
  listPublicGallery,
} from "@/lib/gallery";

export const runtime = "nodejs";

const createSchema = z.object({
  job_id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().max(2000).default(""),
  visibility: z.enum(["public", "private"]).default("public"),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? GALLERY_PAGE_SIZE) || GALLERY_PAGE_SIZE,
    GALLERY_PAGE_SIZE,
  );
  const before = url.searchParams.get("before");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listPublicGallery(supabase, { limit, before });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await getJob(supabase, parsed.data.job_id);
  if (!job || job.user_id !== user.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "completed" || !job.model_glb_path) {
    return NextResponse.json(
      { error: "Only completed jobs with an exported model can be shared." },
      { status: 400 },
    );
  }

  const existing = await getGalleryItemByJob(supabase, job.id);
  if (existing) {
    return NextResponse.json(
      { error: "This job is already in the gallery.", itemId: existing.id },
      { status: 409 },
    );
  }

  try {
    const item = await createGalleryItem(supabase, {
      job_id: job.id,
      user_id: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
    });
    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not create gallery item";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
