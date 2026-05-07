import { createHmac, timingSafeEqual } from "node:crypto";

export function signJobId(jobId: string, secret: string): string {
  return createHmac("sha256", secret).update(jobId).digest("hex");
}

export function verifyJobIdSignature(
  jobId: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !jobId) return false;
  const expected = signJobId(jobId, secret);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function buildWebhookUrl(jobId: string, secret: string): string {
  const sig = signJobId(jobId, secret);
  return `${siteUrl()}/api/fal-webhook?jobId=${jobId}&sig=${sig}`;
}
