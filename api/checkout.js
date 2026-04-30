/**
 * api/checkout.js
 * ----------------
 * Creates a Stripe Checkout Session for a given plan.
 * Called from the frontend when a user clicks "Get Offer Sprint" or
 * "Get Offer in Hand". Returns a Checkout URL that Stripe hosts — the
 * user is redirected there, pays, then redirected back to the app.
 *
 * Environment variables required (set in Vercel dashboard):
 *   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
 *   STRIPE_SPRINT_PRICE_ID       — price_... Offer Sprint ($29)
 *   STRIPE_PRO_PRICE_ID          — price_... Offer in Hand ($49)
 *   STRIPE_STUDENT_PLUS_PRICE_ID — price_... Student Plus (USD one-time — set amount in Stripe; 30-day app access via webhook)
 *   NEXT_PUBLIC_APP_URL          — https://offeradvisor.ai  (used for redirect URLs)
 *
 * Optional curated promotion codes (50% off, etc.):
 *   STRIPE_CHECKOUT_PROMO_MAP  — JSON object: { "YOURCODE": "promo_xxx", ... }
 *   Keys are what you share (case-insensitive). Values are Stripe *promotion code* IDs
 *   (Dashboard → Product catalog → Coupons → Promotion codes → copy API ID `promo_...`).
 *   When a key matches, that discount is applied at checkout. When the field is empty,
 *   Stripe still shows “Add promotion code” if you use public codes in Stripe.
 *
 * Request body:
 *   { plan: "sprint" | "pro" | "student_plus", clerkUserId: string, userEmail: string, promotionCode?: string }
 *
 * Response:
 *   { url: "https://checkout.stripe.com/..." }
 */

import Stripe from "stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://offeradvisor.ai";

/** @returns {Record<string, string>|null} */
function parsePromoMap() {
  const raw = process.env.STRIPE_CHECKOUT_PROMO_MAP;
  if (!raw || typeof raw !== "string") return null;
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === "object" && !Array.isArray(o)) return o;
  } catch (e) {
    console.error("STRIPE_CHECKOUT_PROMO_MAP JSON parse error:", e.message);
  }
  return null;
}

/** Human-facing code → Stripe promotion_code id (promo_...) */
function resolvePromotionCodeId(humanCode) {
  if (!humanCode || typeof humanCode !== "string") return null;
  const key = humanCode.trim().toUpperCase();
  if (!key) return null;
  const map = parsePromoMap();
  if (!map) return null;
  const id = map[key];
  return typeof id === "string" && id.startsWith("promo_") ? id : null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, clerkUserId, userEmail, promotionCode } = req.body;

  // ── Validate inputs ─────────────────────────────────────────────────────────
  if (!plan || !["sprint", "pro", "student_plus"].includes(plan)) {
    return res.status(400).json({
      error: `Invalid plan "${plan}". Must be "sprint", "pro", or "student_plus".`,
    });
  }

  if (!clerkUserId) {
    return res.status(401).json({ error: "User must be signed in to checkout." });
  }

  // ── Validate env vars before calling Stripe ─────────────────────────────────
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY is not set");
    return res.status(500).json({
      error: "Payment system not configured. Please contact support.",
      code: "STRIPE_NOT_CONFIGURED",
    });
  }

  const priceEnvKey =
    plan === "sprint"
      ? "STRIPE_SPRINT_PRICE_ID"
      : plan === "pro"
        ? "STRIPE_PRO_PRICE_ID"
        : "STRIPE_STUDENT_PLUS_PRICE_ID";
  const priceId = process.env[priceEnvKey];
  if (!priceId) {
    console.error(`${priceEnvKey} is not set`);
    return res.status(500).json({
      error: `Price for "${plan}" plan not configured. Please contact support.`,
      code: "PRICE_NOT_CONFIGURED",
    });
  }

  const trimmedPromo =
    typeof promotionCode === "string" ? promotionCode.trim() : "";
  const stripePromoId = trimmedPromo ? resolvePromotionCodeId(trimmedPromo) : null;
  if (trimmedPromo && !stripePromoId) {
    return res.status(400).json({
      error:
        "That promotion code is not recognized. Double-check the code or leave the field empty to pay full price.",
      code: "INVALID_PROMOTION_CODE",
    });
  }

  try {
    const stripe = new Stripe(stripeKey);

    // Cannot combine `discounts` with `allow_promotion_codes` on the same session.
    const sessionParams = {
      mode: "payment",                    // one-time payment, not subscription
      payment_method_types: ["card"],

      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],

      // Pass Clerk user ID in metadata — the webhook uses this to update the plan
      metadata: {
        clerkUserId,
        plan,
        ...(trimmedPromo && { promotionCodeApplied: trimmedPromo.toUpperCase() }),
      },

      // Pre-fill email if we have it (reduces friction)
      ...(userEmail && {
        customer_email: userEmail,
      }),

      // Where to send the user after success / cancel
      success_url: `${APP_URL}/app?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/app?checkout=cancelled`,
    };

    if (stripePromoId) {
      sessionParams.discounts = [{ promotion_code: stripePromoId }];
    } else {
      sessionParams.allow_promotion_codes = true;
    }

    // ── Create Stripe Checkout Session ──────────────────────────────────────────
    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(
      `Checkout session created: ${session.id} | user: ${clerkUserId} | plan: ${plan}${stripePromoId ? ` | promo: ${trimmedPromo.toUpperCase()}` : ""}`
    );

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Stripe checkout error:", err.type, err.message);
    return res.status(500).json({
      error: "Could not create checkout session. Please try again.",
      code: "STRIPE_ERROR",
    });
  }
}
