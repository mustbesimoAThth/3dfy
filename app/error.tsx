"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="container mx-auto grid min-h-screen max-w-md place-items-center px-4 text-center">
      <div className="space-y-3">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold">Something broke</h1>
        <p className="text-sm text-muted-foreground">
          The server hit an error rendering this page. The most common cause is
          a missing or misconfigured environment variable on the deployment.
        </p>
        {error.digest && (
          <p className="text-[11px] text-muted-foreground">
            digest: <code>{error.digest}</code>
          </p>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-border bg-background/40 px-4 py-2 text-sm font-medium backdrop-blur"
          >
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
