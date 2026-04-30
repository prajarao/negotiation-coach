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

// Usage limits per plan
const PLAN_LIMITS = {
  free: { sessions: 5 },
  sprint: { sessions: 999 },
  student_plus: { sessions: 999 },
  pro: { sessions: 999 },
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
 * @returns {Promise<{ok:boolean, user?:object}>}
 */
export async function requirePlan(req, res, feature, opts = {}) {
  const { allowGuest = false } = opts;
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
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_id", clerkId)
    .single();

  if (error || !user) {
    // User exists in Clerk but not yet in Supabase (webhook lag).
    // Treat as free plan so the request isn't blocked.
    const fallbackUser = { clerk_id: clerkId, plan: "free", usage_count: 0 };
    const allowed = (PLAN_FEATURES[fallbackUser.plan] || PLAN_FEATURES.free).includes(feature);
    if (!allowed) {
      res.status(403).json({
        error: "Upgrade your plan to access this feature",
        code: "PLAN_REQUIRED",
        requiredPlan: "sprint",
      });
      return { ok: false };
    }
    return { ok: true, user: fallbackUser };
  }

  // ── Check plan expiry ──────────────────────────────────────────────────────
  let effectivePlan = user.plan;
  if (user.plan !== "free" && user.plan_expires_at) {
    if (new Date(user.plan_expires_at) < new Date()) {
      effectivePlan = "free";
      // Downgrade in DB
      await supabase
        .from("users")
        .update({ plan: "free" })
        .eq("clerk_id", clerkId);
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

  // ── Check usage limits (for free plan) ─────────────────────────────────────
  const limits = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.free;
  if (effectivePlan === "free" && user.usage_count >= limits.sessions) {
    res.status(403).json({
      error: "You've reached the free plan limit. Upgrade to continue.",
      code: "USAGE_LIMIT",
      currentUsage: user.usage_count,
      limit: limits.sessions,
    });
    return { ok: false };
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
