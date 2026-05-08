"use client";

import { use, useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/client";

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ next?: string; sent?: string }>;
}) {
  const params = use(searchParamsPromise);
  const next = params.next ?? "/app";
  const initialSent = params.sent === "1";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<"magic" | "google" | null>(null);
  const [sent, setSent] = useState(initialSent);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    if (!isSupabaseBrowserConfigured()) return null;
    return createSupabaseBrowserClient();
  }, []);

  if (!supabase) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-left text-sm">
        <p className="font-semibold text-destructive">Supabase is not wired up</p>
        <p className="mt-2 text-muted-foreground">
          The app needs{" "}
          <code className="rounded bg-background px-1 py-0.5 text-xs">
            NEXT_PUBLIC_SUPABASE_URL
          </code>{" "}
          and{" "}
          <code className="rounded bg-background px-1 py-0.5 text-xs">
            NEXT_PUBLIC_SUPABASE_ANON_KEY
          </code>{" "}
          in Vercel.
        </p>
        <ol className="mt-3 list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>
            Vercel → your project → <strong>Settings → Environment Variables</strong>
          </li>
          <li>
            Add both variables for <strong>Production</strong>,{" "}
            <strong>Preview</strong>, and <strong>Development</strong> (preview
            URLs use Preview).
          </li>
          <li>
            <strong>Deployments → Redeploy</strong> (changing env does not update
            old bundles;{" "}
            <code className="text-xs">NEXT_PUBLIC_*</code> is baked in at build
            time).
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Keys:{" "}
          <a
            className="text-primary underline"
            href="https://supabase.com/dashboard/project/_/settings/api"
            target="_blank"
            rel="noreferrer"
          >
            Supabase → Project Settings → API
          </a>
        </p>
      </div>
    );
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("magic");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(null);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function signInWithGoogle() {
    setError(null);
    setLoading("google");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase!.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setError(error.message);
      setLoading(null);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur">
        <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a sign-in link to <strong>{email || "your email"}</strong>.
          The link expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={loading !== null}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        {loading === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon />
        )}
        Continue with Google
      </button>

      <div className="relative py-1 text-center text-xs text-muted-foreground">
        <span className="relative bg-background px-2">or</span>
        <div className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
      </div>

      <form onSubmit={sendMagicLink} className="space-y-3">
        <label className="block text-sm">
          <span className="text-muted-foreground">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            autoComplete="email"
            inputMode="email"
          />
        </label>
        <button
          type="submit"
          disabled={loading !== null || !email}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {loading === "magic" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          Send magic link
        </button>
      </form>

      {error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 11v3.6h5.1c-.2 1.3-1.6 3.7-5.1 3.7-3.1 0-5.6-2.5-5.6-5.7s2.5-5.7 5.6-5.7c1.7 0 2.9.7 3.6 1.4l2.5-2.4C16.6 4.6 14.5 3.6 12 3.6 6.9 3.6 2.8 7.7 2.8 12.6S6.9 21.6 12 21.6c6.9 0 9.5-4.8 9.5-7.3 0-.5 0-.9-.1-1.3H12z"
      />
    </svg>
  );
}
