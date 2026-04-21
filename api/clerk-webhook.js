/**
 * api/clerk-webhook.js
 * ---------------------
 * Receives Clerk webhook events and syncs user data to both
 * Clerk publicMetadata AND the Supabase users table.
 *
 * Setup:
 *  1. In Clerk Dashboard → Webhooks → Add endpoint
 *     URL: https://offeradvisor.ai/api/clerk-webhook
 *     Events: user.created, user.updated
 *  2. Copy the Signing Secret into Vercel env as CLERK_WEBHOOK_SECRET
 *  3. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in Vercel env
 */

import { Webhook } from "svix";
import { clerkClient } from "@clerk/clerk-sdk-node";
import { supabase } from "./_supabase.js";
import { internalApiOrigin } from "./_internal-origin.js";

export const config = { api: { bodyParser: false } };

/** Clerk `email_addresses[0]` is not always the primary (e.g. Google). */
function primaryEmailFromClerkUser(data) {
  const list = data.email_addresses || [];
  const primaryId = data.primary_email_address_id;
  if (primaryId) {
    const match = list.find((a) => a.id === primaryId);
    if (match?.email_address) return match.email_address;
  }
  return list[0]?.email_address || null;
}

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }

  // Read raw body for signature verification
  const rawBody = await buffer(req);

  // Verify the webhook signature using Svix
  const svix_id        = req.headers["svix-id"];
  const svix_timestamp = req.headers["svix-timestamp"];
  const svix_signature = req.headers["svix-signature"];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: "Missing Svix headers" });
  }

  let payload;
  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    payload = wh.verify(rawBody, {
      "svix-id":        svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: "Invalid signature" });
  }

  const { type, data } = payload;
  console.log(`Clerk webhook received: ${type}`);

  // ── user.created ────────────────────────────────────────────────────────────
  if (type === "user.created") {
    const userId = data.id;
    const email = primaryEmailFromClerkUser(data);

    try {
      // 1. Set default plan in Clerk publicMetadata
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          plan: "free",
          planExpiresAt: null,
          expiresAt: null,
          planActivatedAt: new Date().toISOString(),
          sessionCount: 0,
          emailCount: 0,
        },
      });

      // 2. Insert row into Supabase users table
      const { error } = await supabase.from("users").upsert(
        {
          clerk_id:        userId,
          email:           email,
          plan:            "free",
          usage_count:     0,
          plan_expires_at: null,
        },
        { onConflict: "clerk_id" }
      );

      if (error) {
        console.error(`Supabase insert failed for ${userId}:`, error.message);
      } else {
        console.log(`New user ${userId} synced to Supabase with plan: free`);
      }

      // Send welcome email (non-critical — don't fail user creation if email fails)
      if (!email) {
        console.warn(
          `Welcome email skipped for ${userId}: no primary email on user.created (OAuth pending or phone-only). It may arrive on user.updated.`
        );
      } else {
        try {
          const welcomeUrl = `${internalApiOrigin()}/api/send-plan-confirmation`;
          const welcomeRes = await fetch(welcomeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userEmail: email,
              userName: data.first_name || data.username || null,
              plan: "free",
              checkoutSessionId: null,
            }),
          });
          if (!welcomeRes.ok) {
            const errText = await welcomeRes.text();
            console.error(`Failed to send welcome email (${welcomeRes.status}):`, errText);
          } else {
            console.log(`📧 Welcome email sent to ${email}`);
          }
        } catch (emailErr) {
          console.error("Welcome email error:", emailErr.message);
        }
      }
    } catch (err) {
      console.error(`Failed to process user.created for ${userId}:`, err.message);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }
  // ── user.updated ─────────────────────────────────────────────────────────────
  if (type === "user.updated") {
    const userId = data.id;
    const plan   = data.public_metadata?.plan || "free";
    const email = primaryEmailFromClerkUser(data);
    const planExpiresAt =
      data.public_metadata?.expiresAt
      ?? data.public_metadata?.planExpiresAt
      ?? null;

    try {
      // Sync latest plan + email + expiry to Supabase (matches Stripe webhook + App.jsx)
      const { error } = await supabase.from("users").upsert(
        {
          clerk_id:        userId,
          email:           email,
          plan:            plan,
          plan_expires_at: planExpiresAt,
        },
        { onConflict: "clerk_id" }
      );

      if (error) {
        console.error(`Supabase update failed for ${userId}:`, error.message);
      } else {
        console.log(`User ${userId} updated in Supabase — plan: ${plan}`);
      }
    } catch (err) {
      console.error(`Failed to process user.updated for ${userId}:`, err.message);
    }
  }

  return res.status(200).json({ received: true });
}
