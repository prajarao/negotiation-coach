/**
 * api/checkout.js
 * ----------------
 * Creates a Stripe Checkout Session for a given plan.
 *
 * Environment variables required (set in Vercel dashboard):
 *   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
 *   STRIPE_SPRINT_PRICE_ID     — price_... for the $29 Offer Sprint product
 *   STRIPE_PRO_PRICE_ID        — price_... for the $49 Offer in Hand product
 *   NEXT_PUBLIC_APP_URL        — https://offeradvisor.ai
 */

import Stripe from "stripe";

export default async function handler(req, res) {
  // ── CORS headers — required for Vercel serverless + Vite SPA ────────────────
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Env var validation — surface missing config clearly ─────────────────────
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set");
    return res.status(500).json({ error: "Stripe is not configured on the server (missing STRIPE_SECRET_KEY). Contact support." });
  }

  const PRICE_IDS = {
    sprint: process.env.STRIPE_SPRINT_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
    student_plus: process.env.STRIPE_STUDENT_PLUS_PRICE_ID,
  };

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://offeradvisor.ai";

  // ── Parse body — Vercel may or may not pre-parse JSON ───────────────────────
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const { plan, clerkUserId, userEmail } = body;

  // ── Input validation ────────────────────────────────────────────────────────
  if (!plan || !["sprint", "pro", "student_plus"].includes(plan)) {
    return res.status(400).json({
      error: `Invalid plan "${plan}". Expected "sprint", "pro", or "student_plus".`,
    });
  }

  if (!clerkUserId) {
    return res.status(401).json({
      error: "You must be signed in to upgrade. Please sign in and try again.",
    });
  }

  if (!PRICE_IDS[plan]) {
    const envVar =
      plan === "sprint"
        ? "STRIPE_SPRINT_PRICE_ID"
        : plan === "pro"
          ? "STRIPE_PRO_PRICE_ID"
          : "STRIPE_STUDENT_PLUS_PRICE_ID";
    console.error(`${envVar} is not set`);
    return res.status(500).json({
      error: `Payment not configured for this plan (missing ${envVar}). Contact support.`,
    });
  }

  // ── Create Stripe client fresh per request (Vercel serverless best practice) ─
  let stripe;
  try {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-11-20",
    });
  } catch (err) {
    console.error("Failed to initialise Stripe:", err.message);
    return res.status(500).json({ error: "Stripe initialisation failed: " + err.message });
  }

  // ── Create Checkout Session ──────────────────────────────────────────────────
  try {
    const sessionParams = {
      mode: "payment",
      payment_method_types: ["card"],

      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],

      metadata: { clerkUserId, plan },

      success_url: `${APP_URL}/?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/?checkout=cancelled`,

      allow_promotion_codes: true,
    };

    // Only set customer_email if it's a valid non-empty string
    if (userEmail && typeof userEmail === "string" && userEmail.includes("@")) {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`Checkout session created: ${session.id} | user: ${clerkUserId} | plan: ${plan}`);
    return res.status(200).json({ url: session.url });

  } catch (err) {
    // Surface the actual Stripe error — not a generic message
    const stripeMsg = err?.raw?.message || err?.message || "Unknown Stripe error";
    console.error("Stripe checkout.sessions.create failed:", stripeMsg);
    return res.status(500).json({
      error: stripeMsg,
      hint: "Check Vercel function logs for the full Stripe error."
    });
  }
}
