import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listRecentJobs } from "@/lib/jobs";
import { Studio } from "./studio";

export const dynamic = "force-dynamic";

export default async function AppHomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout already enforces auth, but TS-narrow here.
  const initialJobs = user ? await listRecentJobs(supabase, user.id, 24) : [];

  return (
    <main className="container mx-auto px-4 py-6">
      <Studio initialJobs={initialJobs} userId={user!.id} />
    </main>
  );
}
