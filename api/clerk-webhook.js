/**
 * api/clerk-webhook.js
 * ---------------------
 * Receives Clerk webhook events and syncs user data.
 * Currently handles:
 *   user.created  — sets default plan to "free" in publicMetadata
 *
 * Setup:
 *  1. In Clerk Dashboard → Webhooks → Add endpoint
 *     URL: https://offeradvisor.ai/api/clerk-webhook
 *     Events: user.created, user.updated
 *  2. Copy the Signing Secret into Vercel env as CLERK_WEBHOOK_SECRET
 *  3. npm install svix  (Clerk uses Svix for webhook verification)
 */

import { Webhook } from "svix";
import { clerkClient } from "@clerk/clerk-sdk-node";

export const config = { api: { bodyParser: false } };

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
    try {
      // Set default plan in publicMetadata — readable client-side via useUser()
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: {
          plan: "free",
          planActivatedAt: new Date().toISOString(),
          sessionCount: 0,
          emailCount: 0,
        },
      });
      console.log(`New user ${userId} initialised with plan: free`);
    } catch (err) {
      console.error(`Failed to set metadata for user ${userId}:`, err.message);
      return res.status(500).json({ error: "Failed to update user metadata" });
    }
  }

  // ── user.updated ─────────────────────────────────────────────────────────────
  // Triggered when plan is changed (e.g. after Stripe payment webhook updates it)
  if (type === "user.updated") {
    const userId = data.id;
    const plan   = data.public_metadata?.plan;
    console.log(`User ${userId} updated — plan: ${plan}`);
    // Additional logic (e.g. send welcome email) can go here
  }

  return res.status(200).json({ received: true });
}
