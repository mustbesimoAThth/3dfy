/** Only company addresses on this domain may sign in. */
export const ALLOWED_EMAIL_DOMAIN = "harrythehirer.com.au";

/** Human-readable copy reused by the form and the server-side guards. */
export const ALLOWED_EMAIL_MESSAGE = `Only @${ALLOWED_EMAIL_DOMAIN} email addresses can sign in.`;

/** Exact-domain match (case-insensitive); rejects look-alikes and subdomains. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = email?.split("@")[1]?.trim().toLowerCase();
  return domain === ALLOWED_EMAIL_DOMAIN;
}
