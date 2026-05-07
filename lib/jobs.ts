import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, JobInsert, JobRow, JobUpdate } from "@/lib/types/database";

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
