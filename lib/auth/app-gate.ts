/**
 * Single shared "access password" front door.
 *
 * There is no per-user sign-in: everyone who enters APP_ACCESS_PASSWORD at
 * /gate is signed into one shared Supabase account (SHARED_ACCOUNT_EMAIL),
 * whose Supabase password must equal APP_ACCESS_PASSWORD. The Supabase session
 * cookie is the source of truth — protected routes just check for a user.
 */

export function accessPassword(): string | undefined {
  return process.env.APP_ACCESS_PASSWORD?.trim() || undefined;
}

export function sharedAccountEmail(): string | undefined {
  return process.env.SHARED_ACCOUNT_EMAIL?.trim() || undefined;
}

/** True once both the password and the shared account email are configured. */
export function isAppGateConfigured(): boolean {
  return Boolean(accessPassword() && sharedAccountEmail());
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
