"use client";

import { use, useMemo, useState } from "react";
import { Loader2, Lock, Mail } from "lucide-react";
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from "@/lib/supabase/client";
import {
  ALLOWED_EMAIL_DOMAIN,
  ALLOWED_EMAIL_MESSAGE,
  isAllowedEmail,
} from "@/lib/auth/allowed-email";

type Method = "magic" | "password";
type PasswordMode = "signin" | "signup";
type Loading = "magic" | "password" | null;
type Sent = "magic" | "signup" | null;

export function LoginForm({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{
    next?: string;
    sent?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>;
}) {
  const params = use(searchParamsPromise);
  const next = params.next ?? "/app";
  const urlAuthError = params.error_description
    ? decodeURIComponent(params.error_description.replace(/\+/g, " "))
    : params.error === "domain"
      ? ALLOWED_EMAIL_MESSAGE
      : params.error_code === "otp_expired"
        ? "This sign-in link has expired or was already used. Request a new one."
        : params.error
          ? "Sign-in failed. Try again."
          : null;

  const [method, setMethod] = useState<Method>("magic");
  const [passwordMode, setPasswordMode] = useState<PasswordMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState<Loading>(null);
  const [sent, setSent] = useState<Sent>(params.sent === "1" ? "magic" : null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(() => {
    if (!isSupabaseBrowserConfigured()) return null;
    return createSupabaseBrowserClient();
  }, []);

  if (!supabase) {
    return (
      <div className="space-y-4">
        {urlAuthError && <ErrorBanner>{urlAuthError}</ErrorBanner>}
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-left text-sm">
          <p className="font-semibold text-destructive">
            Supabase is not wired up
          </p>
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
              Vercel → your project →{" "}
              <strong>Settings → Environment Variables</strong>
            </li>
            <li>
              Add both variables for <strong>Production</strong>,{" "}
              <strong>Preview</strong>, and <strong>Development</strong> (preview
              URLs use Preview).
            </li>
            <li>
              <strong>Deployments → Redeploy</strong> (changing env does not
              update old bundles;{" "}
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
      </div>
    );
  }

  function guardDomain(): boolean {
    if (isAllowedEmail(email)) return true;
    setError(ALLOWED_EMAIL_MESSAGE);
    return false;
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!guardDomain()) return;
    setLoading("magic");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase!.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setLoading(null);
    if (error) setError(error.message);
    else setSent("magic");
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!guardDomain()) return;
    setLoading("password");

    if (passwordMode === "signup") {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { data, error } = await supabase!.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      setLoading(null);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        window.location.assign(next);
        return;
      }
      setSent("signup");
      return;
    }

    const { error } = await supabase!.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(null);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.assign(next);
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur">
        <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold">Check your inbox</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sent === "signup" ? (
            <>
              Confirm your account from the link we sent to{" "}
              <strong>{email || "your email"}</strong>, then come back to sign
              in.
            </>
          ) : (
            <>
              We sent a sign-in link to <strong>{email || "your email"}</strong>
              . The link expires in 1 hour.
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {urlAuthError && <ErrorBanner>{urlAuthError}</ErrorBanner>}

      <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background/50 p-1 text-sm">
        <MethodTab
          active={method === "magic"}
          onClick={() => {
            setMethod("magic");
            setError(null);
          }}
          icon={<Mail className="h-4 w-4" />}
          label="Magic link"
        />
        <MethodTab
          active={method === "password"}
          onClick={() => {
            setMethod("password");
            setError(null);
          }}
          icon={<Lock className="h-4 w-4" />}
          label="Password"
        />
      </div>

      {method === "magic" ? (
        <form onSubmit={sendMagicLink} className="space-y-3">
          <EmailField value={email} onChange={setEmail} />
          <SubmitButton loading={loading === "magic"} disabled={!email}>
            <Mail className="h-4 w-4" />
            Send magic link
          </SubmitButton>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="space-y-3">
          <EmailField value={email} onChange={setEmail} />
          <label className="block text-sm">
            <span className="text-muted-foreground">Password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              autoComplete={
                passwordMode === "signup" ? "new-password" : "current-password"
              }
            />
          </label>
          <SubmitButton
            loading={loading === "password"}
            disabled={!email || password.length < 8}
          >
            <Lock className="h-4 w-4" />
            {passwordMode === "signup" ? "Create account" : "Sign in"}
          </SubmitButton>
          <button
            type="button"
            onClick={() => {
              setPasswordMode((m) => (m === "signup" ? "signin" : "signup"));
              setError(null);
            }}
            className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            {passwordMode === "signup"
              ? "Already have an account? Sign in"
              : `New here? Create an account with your @${ALLOWED_EMAIL_DOMAIN} email`}
          </button>
        </form>
      )}

      {error && <ErrorBanner>{error}</ErrorBanner>}
    </div>
  );
}

function MethodTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 font-medium transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted-foreground">Email</span>
      <input
        type="email"
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        autoComplete="email"
        inputMode="email"
      />
    </label>
  );
}

function SubmitButton({
  loading,
  disabled,
  children,
}: {
  loading: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {children}
    </p>
  );
}
