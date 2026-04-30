/**
 * api/stripe-webhook.js
 * ----------------------
 * Receives Stripe webhook events after payment.
 * On checkout.session.completed:
 *   1. Reads clerkUserId + plan from the session metadata
 *   2. Updates the user's Clerk publicMetadata with their new plan
 *   3. Sets plan expiry: Sprint = 30 days from payment; Pro = no expiry (null)
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
import { supabase } from "./_supabase.js";
import { sendPlanConfirmationEmail } from "./_plan-confirmation-email.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

      // Sprint & Student Plus: 30-day access. Pro: lifetime (no expiry).
      let planExpiresAtIso = null;
      if (plan === "sprint" || plan === "student_plus") {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        planExpiresAtIso = d.toISOString();
      }

      try {
        await clerkClient.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            plan,
            planActivatedAt: new Date().toISOString(),
            // App.jsx reads `expiresAt`; keep `planExpiresAt` for older clients / tools
            ...((plan === "sprint" || plan === "student_plus") && planExpiresAtIso
              ? { planExpiresAt: planExpiresAtIso, expiresAt: planExpiresAtIso }
              : { planExpiresAt: null, expiresAt: null }),
            stripeSessionId: session.id,
            stripeCustomerId: session.customer || null,
            sessionCount: 0,
            emailCount: 0,
          },
        });

        // Fetch Clerk user for email and name (used by both emails below)
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        const primaryId = clerkUser.primaryEmailAddressId;
        const addrs = clerkUser.emailAddresses || [];
        const primaryAddr = primaryId ? addrs.find((a) => a.id === primaryId) : null;
        const userEmail =
          primaryAddr?.emailAddress ||
          addrs[0]?.emailAddress ||
          session.customer_email;

        try {
          const emailResult = await sendPlanConfirmationEmail({
            userEmail,
            userName: clerkUser.firstName || "",
            plan,
            checkoutSessionId: session.id,
          });
          if (!emailResult.ok) {
            console.error("Failed to send plan confirmation email:", emailResult.status, emailResult.error);
          } else {
            console.log(`✓ Plan confirmation email sent to ${userEmail}`);
          }
        } catch (emailError) {
          console.error("Email send error:", emailError);
        }

        // Update Supabase users table — this is what the server-side plan gate reads
        const { error: sbError } = await supabase.from("users").upsert(
          {
            clerk_id:        clerkUserId,
            plan,
            usage_count:     0,
            plan_expires_at: planExpiresAtIso,
          },
          { onConflict: "clerk_id" }
        );
        if (sbError) {
          console.error(`Supabase update failed for ${clerkUserId}:`, sbError.message);
        }

        // ── Send Stripe receipt email ──────────────────────────────────────────
        // Set receipt_email on the PaymentIntent so Stripe sends its built-in receipt
        try {
          if (userEmail && session.payment_intent) {
            await stripe.paymentIntents.update(session.payment_intent, {
              receipt_email: userEmail,
            });
            console.log(`📧 Receipt email queued for ${userEmail}`);
          }
        } catch (emailErr) {
          // Non-critical — don't fail the webhook if receipt fails
          console.error("Failed to set receipt email:", emailErr.message);
        }

        console.log(
          `✅ User ${clerkUserId} upgraded to plan "${plan}"${planExpiresAtIso ? ` — access until ${planExpiresAtIso}` : " — no expiry (Pro)"}`
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
