import crypto from "node:crypto";
import { extractClerkId } from "./_student-verify-auth.js";
import { supabase, supabaseUrlMisconfigured } from "./_supabase.js";

/**
 * POST /api/student-verify-university
 *
 * Body:
 * - Domain + invite (default): { mode?: "domain", email: string, inviteCode: string }
 * - Invite-only (no school inbox): { mode: "invite_only", inviteCode: string }
 *
 * Auth: see `./_student-verify-auth.js`
 */

/** Local/preview: attach Supabase message so failures are actionable (hidden when NODE_ENV=production). */
function exposeDbErrors() {
  return process.env.NODE_ENV !== "production";
}

function withDbDetail(payload, err) {
  if (!err || !exposeDbErrors()) return payload;
  const raw = typeof err.message === "string" ? err.message : "";
  const looksLikeHtml =
    raw.includes("<!DOCTYPE") ||
    raw.includes("<html") ||
    raw.includes("Supabase Studio") ||
    raw.includes("Looking for something?");
  const detail = looksLikeHtml
    ? "Supabase returned HTML instead of JSON — SUPABASE_URL must be https://<project-ref>.supabase.co (Dashboard → Project Settings → API → Project URL), not a dashboard or Studio URL."
    : raw;
  const out = { ...payload, detail };
  if (err.code) out.supabaseCode = err.code;
  if (err.hint) out.supabaseHint = err.hint;
  if (String(err.code) === "PGRST205") {
    out.nextStep =
      "PostgREST cache is stale or tables are in another project. Run in SQL Editor: NOTIFY pgrst, 'reload schema'; Ensure SUPABASE_URL host matches the project where you created the tables.";
  }
  return out;
}

function hashInviteCode(code) {
  return crypto.createHash("sha256").update(String(code).trim().toLowerCase()).digest("hex");
}

function emailDomain(email) {
  const s = String(email).trim().toLowerCase();
  const at = s.lastIndexOf("@");
  if (at < 1 || at === s.length - 1) return null;
  return s.slice(at + 1);
}

async function loadUniversity(universityId) {
  const { data: uni, error } = await supabase
    .from("universities")
    .select("id, slug, name, active")
    .eq("id", universityId)
    .maybeSingle();
  if (error || !uni) return { uni: null, error };
  return { uni, error: null };
}

async function finalizeVerification(clerkId, universityId, inviteRow, uni, verificationMode = "domain") {
  const { data: existing, error: exErr } = await supabase
    .from("university_student_verifications")
    .select("id")
    .eq("clerk_id", clerkId)
    .eq("university_id", universityId)
    .maybeSingle();

  if (exErr) {
    console.error("verification lookup:", exErr);
    return {
      status: 500,
      body: withDbDetail({ ok: false, error: "Verification failed", code: "SERVER_ERROR" }, exErr),
    };
  }

  if (existing) {
    return {
      status: 200,
      body: {
        ok: true,
        alreadyVerified: true,
        verificationMode,
        university: { id: uni.id, slug: uni.slug, name: uni.name },
      },
    };
  }

  const { data: claimed, error: claimErr } = await supabase.rpc("claim_university_invite", {
    p_invite_id: inviteRow.id,
  });

  if (claimErr) {
    console.error("claim_university_invite:", claimErr);
    return {
      status: 500,
      body: withDbDetail({ ok: false, error: "Could not apply invite code", code: "SERVER_ERROR" }, claimErr),
    };
  }

  const claimedOk = claimed === true || claimed === "true";
  if (!claimedOk) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "This invite code was just used up. Ask your career center for a new code.",
        code: "INVITE_EXHAUSTED",
      },
    };
  }

  const { error: insErr } = await supabase.from("university_student_verifications").insert({
    clerk_id: clerkId,
    university_id: universityId,
    invite_code_id: inviteRow.id,
  });

  if (insErr) {
    console.error("university_student_verifications insert:", insErr);
    return {
      status: 500,
      body: withDbDetail({ ok: false, error: "Could not save verification", code: "SERVER_ERROR" }, insErr),
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      alreadyVerified: false,
      verificationMode,
      university: { id: uni.id, slug: uni.slug, name: uni.name },
    },
  };
}

async function validateInviteRow(invite) {
  if (!invite || !invite.active) {
    return { ok: false, status: 400, code: "INVALID_INVITE", error: "Invite code does not match a partner school or is not valid." };
  }
  if (invite.expires_at && new Date(invite.expires_at) <= new Date()) {
    return { ok: false, status: 400, code: "INVITE_EXPIRED", error: "This invite code has expired." };
  }
  if (invite.uses_count >= invite.max_uses) {
    return { ok: false, status: 400, code: "INVITE_EXHAUSTED", error: "This invite code has no uses left." };
  }
  return { ok: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
  }

  const clerkId = extractClerkId(req);
  if (!clerkId) {
    return res.status(401).json({ ok: false, error: "Sign in to verify university access", code: "AUTH_REQUIRED" });
  }

  if (supabaseUrlMisconfigured) {
    return res.status(503).json({
      ok: false,
      error:
        "SUPABASE_URL must be the REST API URL (https://xxxx.supabase.co). Copy Project URL from Dashboard → Settings → API — not supabase.com/dashboard.",
      code: "DB_NOT_CONFIGURED",
    });
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !supabase) {
    return res.status(503).json({ ok: false, error: "Database not configured", code: "DB_NOT_CONFIGURED" });
  }

  const body = req.body || {};
  const inviteCodeRaw = body.inviteCode;
  const inviteCode = typeof inviteCodeRaw === "string" ? inviteCodeRaw.trim() : "";
  const mode = body.mode === "invite_only" ? "invite_only" : "domain";

  if (!inviteCode) {
    return res.status(400).json({ ok: false, error: "Invite code is required", code: "INVALID_INVITE" });
  }

  const codeHash = hashInviteCode(inviteCode);

  try {
    if (mode === "invite_only") {
      const { data: invite, error: invErr } = await supabase
        .from("university_invite_codes")
        .select("id, university_id, expires_at, max_uses, uses_count, active")
        .eq("code_hash", codeHash)
        .maybeSingle();

      if (invErr) {
        console.error("university_invite_codes lookup (invite_only):", invErr);
        return res
          .status(500)
          .json(
            withDbDetail(
              {
                ok: false,
                error: "Verification failed",
                code: "SERVER_ERROR",
                hint:
                  typeof invErr.message === "string" && invErr.message.includes("does not exist")
                    ? "Apply `supabase-schema.sql` (university tables + seeds) in the Supabase SQL editor."
                    : undefined,
              },
              invErr
            )
          );
      }

      const invCheck = await validateInviteRow(invite);
      if (!invCheck.ok) {
        return res.status(invCheck.status).json({ ok: false, error: invCheck.error, code: invCheck.code });
      }

      const { uni, error: uniErr } = await loadUniversity(invite.university_id);
      if (uniErr) console.error("universities lookup:", uniErr);
      if (!uni) {
        return res
          .status(500)
          .json(withDbDetail({ ok: false, error: "Verification failed", code: "SERVER_ERROR" }, uniErr));
      }
      if (!uni.active) {
        return res.status(400).json({ ok: false, error: "This university program is not active.", code: "UNIVERSITY_INACTIVE" });
      }

      const result = await finalizeVerification(clerkId, invite.university_id, invite, uni, "invite_only");
      return res.status(result.status).json(result.body);
    }

    // --- domain mode ---
    const email = body.email;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ ok: false, error: "Email is required for school-email verification", code: "INVALID_EMAIL" });
    }

    const domain = emailDomain(email);
    if (!domain) {
      return res.status(400).json({ ok: false, error: "Invalid email format", code: "INVALID_EMAIL" });
    }

    const { data: domainRow, error: domErr } = await supabase
      .from("university_domains")
      .select("university_id")
      .eq("domain", domain)
      .maybeSingle();

    if (domErr) {
      console.error("university_domains lookup:", domErr);
      return res.status(500).json(withDbDetail({ ok: false, error: "Verification failed", code: "SERVER_ERROR" }, domErr));
    }

    if (!domainRow?.university_id) {
      return res.status(400).json({
        ok: false,
        error: "That email domain is not registered for a partner school yet.",
        code: "INVALID_DOMAIN",
      });
    }

    const { uni, error: uniErr } = await loadUniversity(domainRow.university_id);
    if (uniErr) console.error("universities lookup:", uniErr);
    if (!uni) {
      return res.status(500).json(withDbDetail({ ok: false, error: "Verification failed", code: "SERVER_ERROR" }, uniErr));
    }

    if (!uni.active) {
      return res.status(400).json({ ok: false, error: "This university program is not active.", code: "UNIVERSITY_INACTIVE" });
    }

    const { data: invite, error: invErr } = await supabase
      .from("university_invite_codes")
      .select("id, university_id, expires_at, max_uses, uses_count, active")
      .eq("university_id", domainRow.university_id)
      .eq("code_hash", codeHash)
      .maybeSingle();

    if (invErr) {
      console.error("university_invite_codes lookup:", invErr);
      return res.status(500).json(withDbDetail({ ok: false, error: "Verification failed", code: "SERVER_ERROR" }, invErr));
    }

    const invCheck = await validateInviteRow(invite);
    if (!invCheck.ok) {
      return res.status(invCheck.status).json({ ok: false, error: invCheck.error, code: invCheck.code });
    }

    const result = await finalizeVerification(clerkId, domainRow.university_id, invite, uni, "domain");
    return res.status(result.status).json(result.body);
  } catch (e) {
    console.error("student-verify-university:", e);
    const payload = { ok: false, error: "Server error", code: "SERVER_ERROR" };
    if (exposeDbErrors() && e?.message) payload.detail = e.message;
    return res.status(500).json(payload);
  }
}
