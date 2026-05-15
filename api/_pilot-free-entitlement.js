/**
 * Free Student Plus for pilot universities after campus verification (no Stripe).
 *
 * Env:
 *   PILOT_FREE_UNIVERSITY_IDS  — comma-separated Supabase UUIDs of universities that get auto student_plus
 *   PILOT_FREE_PLAN_EXPIRES_AT — optional ISO-8601; sets Clerk expiresAt/planExpiresAt + users.plan_expires_at (null = no expiry)
 *
 * Requires CLERK_SECRET_KEY for Clerk metadata (same as stripe-webhook / clerk-webhook).
 */

import { clerkClient } from "@clerk/clerk-sdk-node";
import { supabase } from "./_supabase.js";

function parsePilotFreeUniversityIds() {
  const raw = process.env.PILOT_FREE_UNIVERSITY_IDS;
  if (!raw || typeof raw !== "string") return new Set();
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(ids);
}

function pilotPlanExpiresAtIso() {
  const raw = process.env.PILOT_FREE_PLAN_EXPIRES_AT;
  if (!raw || typeof raw !== "string" || !raw.trim()) return null;
  const d = new Date(raw.trim());
  if (Number.isNaN(d.getTime())) {
    console.warn("[pilot-free] Invalid PILOT_FREE_PLAN_EXPIRES_AT — ignoring");
    return null;
  }
  return d.toISOString();
}

/**
 * @param {object} args
 * @param {string} args.clerkId
 * @param {string} args.universityId
 * @returns {Promise<{ applied: boolean, warning?: string }>}
 */
export async function applyPilotFreeStudentPlus({ clerkId, universityId }) {
  const allowed = parsePilotFreeUniversityIds();
  if (!universityId || !allowed.has(universityId)) {
    return { applied: false };
  }

  const planExpiresAtIso = pilotPlanExpiresAtIso();
  const hasExpiry = Boolean(planExpiresAtIso);

  let warning;

  if (process.env.CLERK_SECRET_KEY) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkId);
      const prev = clerkUser.publicMetadata || {};
      await clerkClient.users.updateUserMetadata(clerkId, {
        publicMetadata: {
          ...prev,
          plan: "student_plus",
          planActivatedAt: new Date().toISOString(),
          ...(hasExpiry
            ? { planExpiresAt: planExpiresAtIso, expiresAt: planExpiresAtIso }
            : { planExpiresAt: null, expiresAt: null }),
          pilotFreeUniversityId: universityId,
          sessionCount: prev.sessionCount ?? 0,
          emailCount: prev.emailCount ?? 0,
        },
      });
    } catch (e) {
      console.error("[pilot-free] Clerk updateUserMetadata:", e?.message || e);
      warning =
        warning ||
        "Pilot plan sync failed in Clerk. Your school link is saved; refresh later or contact support if BRIDGE stays locked.";
    }
  } else {
    console.error("[pilot-free] CLERK_SECRET_KEY not set — skipping Clerk pilot plan sync");
    warning =
      "Pilot plan could not update your session (server config). Verification is saved; sign out and in later or contact support.";
  }

  try {
    const { data: existingRow } = await supabase
      .from("users")
      .select("usage_count, student_offer_compare_count")
      .eq("clerk_id", clerkId)
      .maybeSingle();

    const { error: sbError } = await supabase.from("users").upsert(
      {
        clerk_id: clerkId,
        plan: "student_plus",
        usage_count: existingRow?.usage_count ?? 0,
        student_offer_compare_count: existingRow?.student_offer_compare_count ?? 0,
        plan_expires_at: hasExpiry ? planExpiresAtIso : null,
      },
      { onConflict: "clerk_id" }
    );
    if (sbError) {
      console.error("[pilot-free] Supabase users upsert:", sbError.message);
      warning =
        warning ||
        "Pilot plan sync failed in the database. Verification is saved; contact support if limits look wrong.";
    }
  } catch (e) {
    console.error("[pilot-free] Supabase users upsert:", e?.message || e);
    warning =
      warning ||
      "Pilot plan sync failed in the database. Verification is saved; contact support if limits look wrong.";
  }

  return {
    applied: !warning,
    ...(warning ? { warning } : {}),
  };
}
