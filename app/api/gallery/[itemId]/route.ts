import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  deleteGalleryItem,
  getGalleryItem,
  updateGalleryItem,
} from "@/lib/gallery";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    description: z.string().max(2000).optional(),
    visibility: z.enum(["public", "private"]).optional(),
  })
  .refine(
    (v) => v.title !== undefined || v.description !== undefined || v.visibility !== undefined,
    { message: "Provide at least one field to update." },
  );

export async function GET(
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
  const item = await getGalleryItem(supabase, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ item, viewerId: user.id });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
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

  // RLS will reject if the caller isn't the owner; we still pre-check for
  // a tidy 404 vs. 403.
  const item = await getGalleryItem(supabase, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await updateGalleryItem(supabase, itemId, parsed.data);
  return NextResponse.json({ item: updated });
}

export async function DELETE(
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
  const item = await getGalleryItem(supabase, itemId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (item.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await deleteGalleryItem(supabase, itemId);
  return NextResponse.json({ ok: true });
}
