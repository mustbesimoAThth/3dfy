import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  JobInputRow,
  JobInsert,
  JobRow,
  JobUpdate,
} from "@/lib/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = SupabaseClient<Database, "public", any>;

export async function insertJob(supabase: Client, row: JobInsert): Promise<JobRow> {
  const { data, error } = await supabase
    .from("jobs")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateJob(
  supabase: Client,
  id: string,
  patch: JobUpdate,
): Promise<JobRow> {
  const { data, error } = await supabase
    .from("jobs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function getJob(supabase: Client, id: string): Promise<JobRow | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listRecentJobs(
  supabase: Client,
  userId: string,
  limit = 24,
): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function countJobsLast24h(
  supabase: Client,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Insert one row per input image, in display order. The first path is
 * `position: 0`. Caller must already have validated paths against the user's
 * own folder (RLS will reject otherwise).
 */
export async function insertJobInputs(
  supabase: Client,
  jobId: string,
  userId: string,
  imagePaths: string[],
): Promise<void> {
  if (imagePaths.length === 0) return;
  const rows = imagePaths.map((image_path, position) => ({
    job_id: jobId,
    user_id: userId,
    image_path,
    position,
  }));
  const { error } = await supabase.from("job_inputs").insert(rows);
  if (error) throw error;
}

/**
 * Returns input image paths for a job in display order. May return an empty
 * array for legacy jobs created before the `job_inputs` table existed; callers
 * should fall back to `jobs.input_image_path` in that case.
 */
export async function listJobInputs(
  supabase: Client,
  jobId: string,
): Promise<JobInputRow[]> {
  const { data, error } = await supabase
    .from("job_inputs")
    .select("*")
    .eq("job_id", jobId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
