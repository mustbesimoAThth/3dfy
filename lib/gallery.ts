import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  GalleryCommentRow,
  GalleryItemInsert,
  GalleryItemRow,
  GalleryItemUpdate,
  JobRow,
  ProfileRow,
} from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<Database, "public", any>;

export const GALLERY_PAGE_SIZE = 24;

/**
 * Hydrated row used by feed/detail UIs. Joins the underlying `jobs` row (to
 * reach the asset paths + which model was used) and the author profile.
 */
export interface GalleryItemWithRels extends GalleryItemRow {
  job: Pick<
    JobRow,
    | "id"
    | "model"
    | "input_image_path"
    | "model_glb_path"
    | "model_pbr_glb_path"
    | "preview_image_url"
    | "status"
  >;
  author: Pick<ProfileRow, "id" | "display_name">;
}

// Disambiguate the embed via explicit FK constraint names. PostgREST also
// auto-discovers many-to-many relationships through `gallery_likes` and
// `gallery_comments` (both have FKs to `profiles` and to `gallery_items`),
// which would otherwise make `profiles` ambiguous.
const ITEM_SELECT = `
  *,
  job:jobs!gallery_items_job_id_fkey (
    id,
    model,
    input_image_path,
    model_glb_path,
    model_pbr_glb_path,
    preview_image_url,
    status
  ),
  author:profiles!gallery_items_user_id_fkey (
    id,
    display_name
  )
`;

export async function getGalleryItem(
  supabase: Client,
  id: string,
): Promise<GalleryItemWithRels | null> {
  const { data, error } = await supabase
    .from("gallery_items")
    .select(ITEM_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as GalleryItemWithRels) ?? null;
}

export async function getGalleryItemByJob(
  supabase: Client,
  jobId: string,
): Promise<GalleryItemRow | null> {
  const { data, error } = await supabase
    .from("gallery_items")
    .select("*")
    .eq("job_id", jobId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPublicGallery(
  supabase: Client,
  opts: { limit?: number; before?: string | null } = {},
): Promise<GalleryItemWithRels[]> {
  const limit = opts.limit ?? GALLERY_PAGE_SIZE;
  let q = supabase
    .from("gallery_items")
    .select(ITEM_SELECT)
    .eq("visibility", "public")
    .eq("moderation", "approved")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.before) q = q.lt("created_at", opts.before);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as GalleryItemWithRels[];
}

export async function listMyGalleryItems(
  supabase: Client,
  userId: string,
): Promise<GalleryItemWithRels[]> {
  const { data, error } = await supabase
    .from("gallery_items")
    .select(ITEM_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as GalleryItemWithRels[];
}

export async function createGalleryItem(
  supabase: Client,
  row: GalleryItemInsert,
): Promise<GalleryItemRow> {
  const { data, error } = await supabase
    .from("gallery_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateGalleryItem(
  supabase: Client,
  id: string,
  patch: GalleryItemUpdate,
): Promise<GalleryItemRow> {
  const { data, error } = await supabase
    .from("gallery_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGalleryItem(supabase: Client, id: string): Promise<void> {
  const { error } = await supabase.from("gallery_items").delete().eq("id", id);
  if (error) throw error;
}

export async function listComments(
  supabase: Client,
  itemId: string,
): Promise<(GalleryCommentRow & { author: Pick<ProfileRow, "id" | "display_name"> })[]> {
  const { data, error } = await supabase
    .from("gallery_comments")
    .select(
      `*, author:profiles!gallery_comments_user_id_fkey (id, display_name)`,
    )
    .eq("gallery_item_id", itemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as (GalleryCommentRow & {
    author: Pick<ProfileRow, "id" | "display_name">;
  })[];
}

export async function hasUserLiked(
  supabase: Client,
  itemId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("gallery_likes")
    .select("user_id")
    .eq("gallery_item_id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function likeItem(
  supabase: Client,
  itemId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("gallery_likes")
    .insert({ gallery_item_id: itemId, user_id: userId });
  if (error) throw error;
}

export async function unlikeItem(
  supabase: Client,
  itemId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from("gallery_likes")
    .delete()
    .eq("gallery_item_id", itemId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function addComment(
  supabase: Client,
  itemId: string,
  userId: string,
  body: string,
): Promise<GalleryCommentRow> {
  const { data, error } = await supabase
    .from("gallery_comments")
    .insert({ gallery_item_id: itemId, user_id: userId, body })
    .select("*")
    .single();
  if (error) throw error;
  return data as GalleryCommentRow;
}

export async function deleteComment(
  supabase: Client,
  itemId: string,
  commentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("gallery_comments")
    .delete()
    .eq("id", commentId)
    .eq("gallery_item_id", itemId);
  if (error) throw error;
}

export async function incrementGalleryView(
  supabase: Client,
  itemId: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("increment_gallery_view", {
    item_id: itemId,
  });
  if (error) throw error;
}
