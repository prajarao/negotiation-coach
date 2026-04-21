#!/usr/bin/env node
/**
 * User billing report — Supabase + Clerk + Stripe
 * -------------------------------------------------
 * Merges:
 *   • Supabase `users` (and `subscriptions` if any rows exist)
 *   • Clerk users (email, created, publicMetadata.plan, Stripe ids from metadata)
 *   • Stripe Checkout sessions with metadata.clerkUserId + paid status
 *
 * Required env (same as production / Vercel):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *   CLERK_SECRET_KEY
 *   STRIPE_SECRET_KEY
 *
 * Clerk users are loaded via the Backend REST API (`https://api.clerk.com/v1/users`) so this
 * script does not import `@clerk/clerk-sdk-node` (avoids a broken optional chain: `snake-case` → `tslib`).
 *
 * Optional: load `.env` from repo root if dotenv is installed (`npm i` already includes dotenv).
 *
 * Usage:
 *   node scripts/user-billing-report.mjs
 *   node scripts/user-billing-report.mjs --json-only
 *   node scripts/user-billing-report.mjs --out reports
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

try {
  const dotenv = await import("dotenv");
  dotenv.config({ path: path.join(repoRoot, ".env") });
} catch {
  /* optional */
}

const args = process.argv.slice(2);
const jsonOnly = args.includes("--json-only");
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : path.join(repoRoot, "reports");

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return v.trim();
}

/** Normalize Clerk REST `User` into the shape this script expects (camelCase). */
function normalizeClerkRestUser(u) {
  const ts = u.created_at;
  const createdAt =
    typeof ts === "number"
      ? new Date(ts).toISOString()
      : ts
        ? new Date(ts).toISOString()
        : null;
  return {
    id: u.id,
    createdAt,
    emailAddresses: (u.email_addresses || []).map((ea) => ({
      emailAddress: ea.email_address,
    })),
    publicMetadata: u.public_metadata || {},
  };
}

async function fetchAllClerkUsers(secretKey) {
  const users = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const url = new URL("https://api.clerk.com/v1/users");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Clerk API ${res.status}: ${text.slice(0, 800)}`);
    }
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error("Clerk API returned non-JSON");
    }
    const batch = (body.data || []).map(normalizeClerkRestUser);
    users.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return users;
}

async function main() {
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_KEY");
  requireEnv("CLERK_SECRET_KEY");
  requireEnv("STRIPE_SECRET_KEY");

  const { createClient } = await import("@supabase/supabase-js");
  const Stripe = (await import("stripe")).default;
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { data: sbUsers, error: sbUsersErr } = await supabase
    .from("users")
    .select("*")
    .order("created_at", { ascending: false });

  if (sbUsersErr) {
    console.error("Supabase users error:", sbUsersErr.message);
    process.exit(1);
  }

  let sbSubs = [];
  const { data: subsData, error: subsErr } = await supabase.from("subscriptions").select("*");
  if (!subsErr) sbSubs = subsData || [];
  else console.warn("Supabase subscriptions (optional):", subsErr.message);

  const clerkUsers = await fetchAllClerkUsers(process.env.CLERK_SECRET_KEY.trim());

  /** Paid checkout sessions with Clerk user in metadata */
  const stripeSessions = [];
  let startingAfter;
  for (;;) {
    const page = await stripe.checkout.sessions.list({
      limit: 100,
      starting_after: startingAfter,
    });
    for (const s of page.data) {
      const clerkUserId = s.metadata?.clerkUserId;
      if (!clerkUserId) continue;
      if (s.payment_status !== "paid") continue;
      stripeSessions.push({
        id: s.id,
        clerkUserId,
        plan: s.metadata?.plan || null,
        promotionCodeApplied: s.metadata?.promotionCodeApplied || null,
        amount_total: s.amount_total,
        currency: s.currency,
        customer: typeof s.customer === "string" ? s.customer : s.customer?.id || null,
        customer_email: s.customer_details?.email || s.customer_email || null,
        created: s.created,
        created_iso: new Date(s.created * 1000).toISOString(),
        payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id || null,
      });
    }
    if (!page.has_more) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  const subsByClerk = new Map();
  for (const row of sbSubs) {
    if (!row.clerk_id) continue;
    if (!subsByClerk.has(row.clerk_id)) subsByClerk.set(row.clerk_id, []);
    subsByClerk.get(row.clerk_id).push(row);
  }

  const sbByClerk = new Map((sbUsers || []).map((u) => [u.clerk_id, u]));
  const stripeByClerk = new Map();
  for (const tx of stripeSessions) {
    if (!stripeByClerk.has(tx.clerkUserId)) stripeByClerk.set(tx.clerkUserId, []);
    stripeByClerk.get(tx.clerkUserId).push(tx);
  }
  for (const [, txs] of stripeByClerk) {
    txs.sort((a, b) => b.created - a.created);
  }

  const clerkIds = new Set([
    ...clerkUsers.map((u) => u.id),
    ...(sbUsers || []).map((u) => u.clerk_id),
    ...stripeSessions.map((s) => s.clerkUserId),
  ]);

  const rows = [];
  for (const clerkId of clerkIds) {
    const cu = clerkUsers.find((u) => u.id === clerkId) || null;
    const sb = sbByClerk.get(clerkId) || null;
    const pm = cu?.publicMetadata || {};
    const clerkPlan = typeof pm.plan === "string" ? pm.plan : null;
    const clerkExpires =
      pm.expiresAt ?? pm.planExpiresAt ?? null;
    const clerkStripeCustomer = pm.stripeCustomerId ?? null;
    const clerkStripeSession = pm.stripeSessionId ?? null;

    const email =
      cu?.emailAddresses?.[0]?.emailAddress ||
      sb?.email ||
      stripeByClerk.get(clerkId)?.[0]?.customer_email ||
      null;

    const txs = stripeByClerk.get(clerkId) || [];
    const totalPaidCents = txs.reduce((sum, t) => sum + (t.amount_total || 0), 0);

    rows.push({
      clerk_id: clerkId,
      email,
      signed_up_clerk: cu?.createdAt || null,
      signed_up_supabase: sb?.created_at || null,
      plan_clerk_public_metadata: clerkPlan,
      plan_clerk_expires_at: clerkExpires,
      plan_supabase: sb?.plan ?? null,
      plan_supabase_expires_at: sb?.plan_expires_at ?? null,
      usage_count_supabase: sb?.usage_count ?? null,
      clerk_stripe_customer_id: clerkStripeCustomer,
      clerk_stripe_session_id_from_metadata: clerkStripeSession,
      supabase_subscriptions_rows: subsByClerk.get(clerkId) || [],
      stripe_paid_checkout_sessions: txs,
      stripe_payment_count: txs.length,
      stripe_total_paid_cents: totalPaidCents,
      in_clerk: !!cu,
      in_supabase: !!sb,
    });
  }

  rows.sort((a, b) => {
    const da = a.signed_up_clerk || a.signed_up_supabase || "";
    const db = b.signed_up_clerk || b.signed_up_supabase || "";
    return db.localeCompare(da);
  });

  const stripeOrphans = stripeSessions.filter(
    (s) => !clerkUsers.some((u) => u.id === s.clerkUserId)
  );

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      clerk_user_count: clerkUsers.length,
      supabase_user_rows: (sbUsers || []).length,
      supabase_subscription_rows: sbSubs.length,
      stripe_paid_sessions_with_clerk_id: stripeSessions.length,
      merged_unique_clerk_ids: rows.length,
      stripe_checkout_sessions_missing_clerk_user: stripeOrphans.length,
    },
    users: rows,
    stripe_checkout_sessions_missing_clerk_user: stripeOrphans,
  };

  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `user-billing-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");

  if (!jsonOnly) {
    console.log("\n# User billing report (Supabase + Clerk + Stripe)\n");
    console.log(`Generated: ${report.generated_at}`);
    console.log(`JSON written: ${outFile}\n`);
    console.log("| Email | Clerk plan | Supabase plan | Payments | Total (major) | Clerk signup |");
    console.log("| --- | --- | --- | ---: | ---: | --- |");
    for (const r of rows) {
      const major = (r.stripe_total_paid_cents / 100).toFixed(2);
      const cur = (r.stripe_paid_checkout_sessions[0]?.currency || "usd").toUpperCase();
      const pay = `${r.stripe_payment_count} (${cur})`;
      const esc = (s) => String(s || "").replace(/\|/g, "\\|").replace(/\n/g, " ");
      console.log(
        `| ${esc(r.email)} | ${esc(r.plan_clerk_public_metadata || "—")} | ${esc(r.plan_supabase || "—")} | ${pay} | ${major} | ${esc(r.signed_up_clerk?.slice(0, 10) || r.signed_up_supabase?.slice(0, 10) || "—")} |`
      );
    }
    if (report.stripe_checkout_sessions_missing_clerk_user.length) {
      console.log("\n## Stripe sessions with unknown Clerk user (deleted / other env)\n");
      for (const s of report.stripe_checkout_sessions_missing_clerk_user) {
        console.log(`- ${s.id} | ${s.clerkUserId} | ${s.plan} | ${s.created_iso} | ${(s.amount_total || 0) / 100} ${s.currency}`);
      }
    }
    console.log("\n## Per-user Stripe transactions (session id, plan, amount, date)\n");
    for (const r of rows) {
      if (!r.stripe_paid_checkout_sessions.length) continue;
      console.log(`### ${r.email || r.clerk_id}`);
      for (const t of r.stripe_paid_checkout_sessions) {
        const amt = t.amount_total != null ? `${(t.amount_total / 100).toFixed(2)} ${t.currency}`.toUpperCase() : "—";
        console.log(`- ${t.id} | plan=${t.plan || "—"} | ${amt} | ${t.created_iso}`);
      }
    }
  } else {
    console.log(outFile);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
