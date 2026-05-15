#!/usr/bin/env node
/**
 * Prints SHA256 hex for an invite code (must match api/student-verify-university.js hashInviteCode).
 * Usage: node scripts/hash-university-invite.mjs <plaintext>
 */
import crypto from "node:crypto";

const raw = process.argv.slice(2).join(" ").trim();
if (!raw) {
  console.error("Usage: node scripts/hash-university-invite.mjs <plaintext-invite-code>");
  process.exit(1);
}

const hex = crypto.createHash("sha256").update(raw.trim().toLowerCase()).digest("hex");
console.log(hex);
