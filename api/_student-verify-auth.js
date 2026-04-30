/**
 * Shared Clerk JWT + localhost dev-header auth for student university APIs.
 */

function hostWithoutPort(hostHeader) {
  const raw = String(hostHeader || "").trim();
  if (!raw) return "";
  const bracket = raw.startsWith("[") && raw.includes("]");
  if (bracket) return raw.slice(1, raw.indexOf("]")).toLowerCase();
  const idx = raw.lastIndexOf(":");
  if (idx > 0 && !raw.includes("]")) return raw.slice(0, idx).toLowerCase();
  return raw.toLowerCase();
}

function isLocalDevHost(req) {
  const h = hostWithoutPort(req.headers?.host);
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

function clerkIdFromDevHeader(req) {
  const secret = process.env.STUDENT_VERIFY_DEV_SECRET;
  if (!secret || typeof secret !== "string") return null;
  const sent = req.headers["x-student-verify-dev"];
  if (typeof sent !== "string" || sent !== secret) return null;
  if (!isLocalDevHost(req)) return null;
  const id = process.env.STUDENT_VERIFY_DEV_CLERK_ID;
  return typeof id === "string" && id.trim() ? id.trim() : "dev_localhost_student_verify";
}

/** Bearer Clerk JWT (`sub`) or dev bypass via X-Student-Verify-Dev + localhost Host */
export function extractClerkId(req) {
  const devId = clerkIdFromDevHeader(req);
  if (devId) return devId;

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    const token = auth.split(" ")[1];
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return payload.sub || null;
  } catch {
    return null;
  }
}
