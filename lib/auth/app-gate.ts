/**
 * Single shared "access password" front door.
 *
 * There is no per-user sign-in: everyone who enters APP_ACCESS_PASSWORD at
 * /gate is signed into one shared Supabase account with a fictitious email,
 * whose Supabase password must equal APP_ACCESS_PASSWORD. The Supabase session
 * cookie is the source of truth — protected routes just check for a user.
 */

const SHARED_ACCOUNT_EMAIL = "studio@app.local";

export function accessPassword(): string | undefined {
  return process.env.APP_ACCESS_PASSWORD?.trim() || undefined;
}

export function sharedAccountEmail(): string {
  return SHARED_ACCOUNT_EMAIL;
}

/** True when the access password is configured. */
export function isAppGateConfigured(): boolean {
  return Boolean(accessPassword());
}

export function isPasswordCorrect(password: string): boolean {
  const expected = accessPassword();
  return Boolean(expected) && password === expected;
}

/** Only allow internal absolute paths to avoid open-redirects. */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/app";
  return next;
}
