/**
 * Canonical HTTPS origin for serverless functions to call other routes on the same app.
 * Set APP_BASE_URL or NEXT_PUBLIC_APP_URL on Vercel (e.g. https://offeradvisor.ai) so webhooks
 * always hit the deployment that has RESEND_API_KEY, not only VERCEL_URL.
 */
export function internalApiOrigin() {
  const explicit = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && typeof explicit === "string") {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://offeradvisor.ai";
}
