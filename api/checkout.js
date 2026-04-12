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
 *   STRIPE_SPRINT_PRICE_ID     — price_... for the $29 Offer Sprint product
 *   STRIPE_PRO_PRICE_ID        — price_... for the $49 Offer in Hand product
 *   NEXT_PUBLIC_APP_URL        — https://offeradvisor.ai  (used for redirect URLs)
 *
 * Request body:
 *   { plan: "sprint" | "pro", clerkUserId: string, userEmail: string }
 *
 * Response:
 *   { url: "https://checkout.stripe.com/..." }
 */

import Stripe from "stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://offeradvisor.ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { plan, clerkUserId, userEmail } = req.body;

  // ── Validate inputs ─────────────────────────────────────────────────────────
  if (!plan || !["sprint", "pro"].includes(plan)) {
    return res.status(400).json({
      error: `Invalid plan "${plan}". Must be "sprint" or "pro".`,
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

  const priceEnvKey = plan === "sprint" ? "STRIPE_SPRINT_PRICE_ID" : "STRIPE_PRO_PRICE_ID";
  const priceId = process.env[priceEnvKey];
  if (!priceId) {
    console.error(`${priceEnvKey} is not set`);
    return res.status(500).json({
      error: `Price for "${plan}" plan not configured. Please contact support.`,
      code: "PRICE_NOT_CONFIGURED",
    });
  }

  try {
    const stripe = new Stripe(stripeKey);

    // ── Create Stripe Checkout Session ──────────────────────────────────────────
    const session = await stripe.checkout.sessions.create({
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
      },

      // Pre-fill email if we have it (reduces friction)
      ...(userEmail && {
        customer_email: userEmail,
      }),

      // Where to send the user after success / cancel
      success_url: `${APP_URL}/?checkout=success&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${APP_URL}/?checkout=cancelled`,

      // Allow promotion codes (e.g. launch discount)
      allow_promotion_codes: true,
    });

    console.log(
      `Checkout session created: ${session.id} | user: ${clerkUserId} | plan: ${plan}`
    );

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Stripe checkout error:", err.type, err.message);
    return res.status(500).json({
      error: "Could not create checkout session. Please try again.",
      code: "STRIPE_ERROR",
      debug: err.message,
    });
  }
}
