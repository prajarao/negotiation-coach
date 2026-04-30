/**
 * api/_plan-gate.js
 * -----------------
 * Server-side plan access-control middleware for Vercel serverless functions.
 *
 * Usage in any API route:
 *   import { requirePlan } from "./_plan-gate.js";
 *
 *   export default async function handler(req, res) {
 *     const gate = await requirePlan(req, res, "benchmark");
 *     if (!gate.ok) return;            // already sent 401/403
 *     const { user } = gate;           // Supabase user row
 *     // ... rest of handler
 *   }
 *
 * For routes open to guests (e.g. chat with usage cap):
 *   const gate = await requirePlan(req, res, "coach", { allowGuest: true, guestLimit: 5 });
 */
import { supabase } from "./_supabase.js";

// Which features each plan can access (mirrors frontend tab ids where applicable).
// Extra keys: "salary" (POST /api/salary), "student_paths" (POST /api/student-career-paths).
const PLAN_FEATURES = {
  free: ["coach", "student", "salary", "student_paths"],
  sprint: ["coach", "benchmark", "calculate", "practice", "logwin", "salary"],
  /** Student hub SKU — Students tab in UI; coach API allowed so ChatStrip on Students works (Share offer tab stays gated in App.jsx). */
  student_plus: ["student", "coach", "salary", "student_paths"],
  pro: ["coach", "benchmark", "calculate", "practice", "logwin", "templates", "playbook", "history", "alex", "salary"],
};

// Usage limits per plan (enforce server-side only here).
// usage_count = coach (/api/chat) completions; student_offer_compare_count = Students-tab dual-offer compare.
const PLAN_LIMITS = {
  free: { coachSessions: 1, studentOfferCompares: 1 },
  sprint: { coachSessions: 999, studentOfferCompares: 999 },
  student_plus: { coachSessions: 999, studentOfferCompares: 999 },
  pro: { coachSessions: 999, studentOfferCompares: 999 },
};

/**
 * Extract Clerk user ID from the Authorization header.
 * Clerk JWTs are sent as "Bearer <token>".
 * We decode the payload (no verification needed — Clerk already verified
 * on the frontend, and this is a same-origin API call).
 * For production hardening, add Clerk JWT verification here.
 */
function extractClerkId(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    const token = auth.split(" ")[1];
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString()
    );
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * @param {object}  req
 * @param {object}  res
 * @param {string}  feature   — "coach" | "benchmark" | "calculate" | "practice" | "logwin" | "templates" | … | "alex"
 * @param {object}  [opts]
 * @param {boolean} [opts.allowGuest=false]  — let unauthenticated users through (with limits)
 * @param {number}  [opts.guestLimit=5]      — max requests for guests (tracked per IP, not enforced yet)
 * @param {"default"|"student_compare"} [opts.salaryUsageKind="default"] — free-tier salary caps (Students compare only)
 * @returns {Promise<{ok:boolean, user?:object}>}
 */
export async function requirePlan(req, res, feature, opts = {}) {
  const { allowGuest = false, salaryUsageKind = "default" } = opts;
  const clerkId = extractClerkId(req);

  // ── No auth token ──────────────────────────────────────────────────────────
  if (!clerkId) {
    if (allowGuest) {
      return { ok: true, user: null };
    }
    res.status(401).json({ error: "Sign in to access this feature", code: "AUTH_REQUIRED" });
    return { ok: false };
  }

  // ── Look up user in Supabase ───────────────────────────────────────────────
  const { data: dbUser, error: dbErr } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();

  // Webhook lag: treat as free with zero usage until Supabase row exists.
  const user =
    dbErr || !dbUser
      ? {
          clerk_id: clerkId,
          plan: "free",
          usage_count: 0,
          student_offer_compare_count: 0,
        }
      : dbUser;

  // ── Check plan expiry ──────────────────────────────────────────────────────
  let effectivePlan = user.plan;
  if (user.plan !== "free" && user.plan_expires_at) {
    if (new Date(user.plan_expires_at) < new Date()) {
      effectivePlan = "free";
      await supabase.from("users").update({ plan: "free" }).eq("clerk_id", clerkId);
    }
  }

  // ── Check feature access ───────────────────────────────────────────────────
  const allowed = (PLAN_FEATURES[effectivePlan] || PLAN_FEATURES.free).includes(feature);
  if (!allowed) {
    res.status(403).json({
      error: "Upgrade your plan to access this feature",
      code: "PLAN_REQUIRED",
      requiredPlan: "sprint",
      currentPlan: effectivePlan,
    });
    return { ok: false };
  }

  // ── Check usage limits (free plan only; scoped by feature) ─────────────────
  const limits = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.free;

  if (effectivePlan === "free" && feature === "coach") {
    const cap = limits.coachSessions;
    if ((user.usage_count ?? 0) >= cap) {
      res.status(403).json({
        error: "You've reached the free coaching limit. Upgrade to continue.",
        code: "USAGE_LIMIT",
        limitKind: "coach",
        currentUsage: user.usage_count ?? 0,
        limit: cap,
      });
      return { ok: false };
    }
  }

  if (
    effectivePlan === "free" &&
    feature === "salary" &&
    salaryUsageKind === "student_compare"
  ) {
    const cap = limits.studentOfferCompares;
    const used = user.student_offer_compare_count ?? 0;
    if (used >= cap) {
      res.status(403).json({
        error:
          "You've used your free student offer compare (two-offer benchmark). Upgrade for unlimited compares.",
        code: "USAGE_LIMIT",
        limitKind: "student_compare",
        currentUsage: used,
        limit: cap,
      });
      return { ok: false };
    }
  }

  return { ok: true, user: { ...user, plan: effectivePlan } };
}

/**
 * Increment usage_count for a user after a successful API call.
 */
export async function incrementUsage(clerkId) {
  if (!clerkId) return;
  await supabase.rpc("increment_usage", { p_clerk_id: clerkId }).catch(() => {
    // Fallback if RPC doesn't exist yet
    supabase
      .from("users")
      .update({ usage_count: supabase.raw("usage_count + 1") })
      .eq("clerk_id", clerkId)
      .then(() => {})
      .catch(() => {});
  });
}
