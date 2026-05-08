import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

function publicUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
}

function publicAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;
}

/** True when the browser can safely create a Supabase client. */
export function isSupabaseBrowserConfigured(): boolean {
  return Boolean(publicUrl() && publicAnonKey());
}

/**
 * Browser client. Only call when {@link isSupabaseBrowserConfigured} is true;
 * otherwise @supabase/ssr throws before this helper runs.
 */
export function createSupabaseBrowserClient(): SupabaseClient<Database> {
  const url = publicUrl();
  const key = publicAnonKey();
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel (all environments you use), then redeploy.",
    );
  }
  return createBrowserClient<Database>(url, key) as unknown as SupabaseClient<Database>;
}

/** Same as {@link createSupabaseBrowserClient} but returns null instead of throwing. */
export function tryCreateSupabaseBrowserClient() {
  const url = publicUrl();
  const key = publicAnonKey();
  if (!url || !key) return null;
  return createBrowserClient<Database>(url, key);
}
