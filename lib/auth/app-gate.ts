/**
 * Site-wide "front door" password. When APP_ACCESS_PASSWORD is set, visitors
 * must enter it once (cookie lasts 30 days) before they can reach the app or
 * the sign-in page. Leave the env var unset to disable the gate entirely.
 */
export const APP_GATE_COOKIE = "app_gate";

/** Mixed into the cookie token so it isn't a bare hash of the password. */
const GATE_PEPPER = "3dfy-app-gate:v1";

export function isAppGateConfigured(): boolean {
  return Boolean(process.env.APP_ACCESS_PASSWORD?.trim());
}

export function isPasswordCorrect(password: string): boolean {
  const expected = process.env.APP_ACCESS_PASSWORD ?? "";
  return Boolean(expected) && password === expected;
}

/** Web Crypto SHA-256 — available in both the edge and Node runtimes. */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Opaque token stored in the gate cookie; middleware compares against this. */
export function expectedGateToken(): Promise<string> {
  return sha256Hex(`${GATE_PEPPER}:${process.env.APP_ACCESS_PASSWORD ?? ""}`);
}

/** Only allow internal absolute paths to avoid open-redirects. */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
