import { extractClerkId } from "./_student-verify-auth.js";
import { supabase, supabaseUrlMisconfigured } from "./_supabase.js";

/**
 * GET /api/student-verification-status
 *
 * Auth: Bearer Clerk JWT or localhost dev header (same as POST verify).
 *
 * Response:
 * - { ok: true, verified: false, universities: [] }
 * - { ok: true, verified: true, universities: [{ id, slug, name, verifiedAt }] }
 */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
  }

  const clerkId = extractClerkId(req);
  if (!clerkId) {
    return res.status(401).json({
      ok: false,
      error: "Sign in to load verification status",
      code: "AUTH_REQUIRED",
    });
  }

  if (supabaseUrlMisconfigured) {
    return res.status(503).json({
      ok: false,
      error:
        "SUPABASE_URL must be the REST API URL (https://xxxx.supabase.co). Copy Project URL from Dashboard → Settings → API.",
      code: "DB_NOT_CONFIGURED",
    });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !supabase) {
    return res.status(503).json({ ok: false, error: "Database not configured", code: "DB_NOT_CONFIGURED" });
  }

  try {
    const { data: rows, error } = await supabase
      .from("university_student_verifications")
      .select("university_id, verified_at")
      .eq("clerk_id", clerkId)
      .order("verified_at", { ascending: true });

    if (error) {
      console.error("student-verification-status verifications:", error);
      return res.status(500).json({ ok: false, error: "Could not load status", code: "SERVER_ERROR" });
    }

    if (!rows?.length) {
      return res.json({ ok: true, verified: false, universities: [] });
    }

    const ids = [...new Set(rows.map((r) => r.university_id).filter(Boolean))];
    const { data: unis, error: uerr } = await supabase.from("universities").select("id, slug, name").in("id", ids);

    if (uerr) {
      console.error("student-verification-status universities:", uerr);
      return res.status(500).json({ ok: false, error: "Could not load status", code: "SERVER_ERROR" });
    }

    const byId = Object.fromEntries((unis || []).map((u) => [u.id, u]));
    const universities = rows
      .map((r) => {
        const u = byId[r.university_id];
        if (!u) return null;
        return {
          id: u.id,
          slug: u.slug,
          name: u.name,
          verifiedAt: r.verified_at,
        };
      })
      .filter(Boolean);

    return res.json({
      ok: true,
      verified: universities.length > 0,
      universities,
    });
  } catch (e) {
    console.error("student-verification-status:", e);
    return res.status(500).json({ ok: false, error: "Server error", code: "SERVER_ERROR" });
  }
}
