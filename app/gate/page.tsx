import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { isAppGateConfigured, sanitizeNext } from "@/lib/auth/app-gate";

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isAppGateConfigured()) redirect("/");

  const sp = await searchParams;
  const next = sanitizeNext(sp.next);
  const hasError = sp.error === "1";

  return (
    <main className="container mx-auto flex min-h-screen max-w-md flex-col px-4 py-10">
      <span className="mb-12 inline-flex items-center font-semibold">
        <BrandMark size="md" priority />
      </span>
      <div className="mb-3 inline-flex w-fit rounded-lg bg-primary/10 p-2 text-primary">
        <Lock className="h-5 w-5" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">Enter access password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This app is private. Enter the access password to continue, then sign in
        with your account.
      </p>

      <form method="post" action="/api/gate" className="mt-8 space-y-3">
        <input type="hidden" name="next" value={next} />
        <label className="block text-sm">
          <span className="text-muted-foreground">Access password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            placeholder="••••••••"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        {hasError && (
          <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Incorrect password. Try again.
          </p>
        )}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Lock className="h-4 w-4" />
          Continue
        </button>
      </form>
    </main>
  );
}
