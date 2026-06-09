import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getJob } from "@/lib/jobs";
import { JobDetail } from "./job-detail";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/gate");

  const job = await getJob(supabase, jobId);
  if (!job || job.user_id !== user.id) notFound();

  return (
    <main className="container mx-auto px-4 py-6">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>
      <JobDetail initialJob={job} />
    </main>
  );
}
