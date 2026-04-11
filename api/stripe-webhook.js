/**
 * api/stripe-webhook.js
 * ----------------------
 * Receives Stripe webhook events after payment.
 * On checkout.session.completed:
 *   1. Reads clerkUserId + plan from the session metadata
 *   2. Updates the user's Clerk publicMetadata with their new plan
 *   3. Sets plan_expires_at 30 days from now (for both sprint and pro)
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY          — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET      — whsec_... from Stripe dashboard → Webhooks
 *   CLERK_SECRET_KEY           — sk_live_... from Clerk dashboard
 *
 * This endpoint must be registered in Stripe Dashboard:
 *   Stripe Dashboard → Webhooks → Add endpoint
 *   URL: https://offeradvisor.ai/api/stripe-webhook
 *   Events: checkout.session.completed, checkout.session.expired
 */

import Stripe from "stripe";
import { clerkClient } from "@clerk/clerk-sdk-node";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20",
});

// Disable Vercel's default body parser — Stripe needs the raw body to verify signatures
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  // ── Verify Stripe signature ─────────────────────────────────────────────────
  const rawBody = await getRawBody(req);
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  console.log(`Stripe webhook received: ${event.type}`);

  // ── Handle events ───────────────────────────────────────────────────────────
  switch (event.type) {

    case "checkout.session.completed": {
      const session = event.data.object;

      // Only process sessions that were paid (not pending)
      if (session.payment_status !== "paid") {
        console.log(`Session ${session.id} not paid yet — skipping`);
        break;
      }

      const { clerkUserId, plan } = session.metadata || {};

      if (!clerkUserId || !plan) {
        console.error("Missing clerkUserId or plan in session metadata", session.id);
        break;
      }

      // Calculate plan expiry — 30 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      try {
        // Update Clerk publicMetadata — this is what the frontend reads via useUser()
        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            plan,                                              // "sprint" | "pro"
            planActivatedAt: new Date().toISOString(),
            planExpiresAt: expiresAt.toISOString(),
            stripeSessionId: session.id,
            stripeCustomerId: session.customer || null,
            sessionCount: 0,                                   // reset usage counter
            emailCount: 0,
          },
        });

        console.log(
          `✅ User ${clerkUserId} upgraded to plan "${plan}" — expires ${expiresAt.toDateString()}`
        );
      } catch (err) {
        console.error(`Failed to update Clerk metadata for ${clerkUserId}:`, err.message);
        // Return 500 — Stripe will retry the webhook
        return res.status(500).json({ error: "Failed to update user plan" });
      }

      break;
    }

    case "checkout.session.expired": {
      // User abandoned checkout — nothing to do, log for analytics
      const session = event.data.object;
      const { clerkUserId, plan } = session.metadata || {};
      console.log(`Checkout abandoned — user: ${clerkUserId} | plan: ${plan}`);
      break;
    }

    default:
      // Unhandled event type — acknowledge receipt, do nothing
      console.log(`Unhandled Stripe event: ${event.type}`);
  }

  // Always return 200 to acknowledge receipt
  return res.status(200).json({ received: true });
}
