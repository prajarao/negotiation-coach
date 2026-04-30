/**
 * Exercise POST /api/student-verify-university without Clerk (localhost + dev secret).
 *
 * Prerequisites:
 * - server.js listening on 3001 with SUPABASE_* set (service role key)
 * - Same tables/seeds as production: run `supabase-schema.sql` in Supabase SQL Editor if you see `detail` mentioning missing relation
 * - .env: STUDENT_VERIFY_DEV_SECRET=… (must match header below)
 *
 * Usage:
 *   node scripts/test-student-verify.mjs              # invite_only + demo code
 *   node scripts/test-student-verify.mjs domain       # email domain + pilot2026
 */

import dotenv from "dotenv";

dotenv.config({ quiet: true });

const secret = process.env.STUDENT_VERIFY_DEV_SECRET;
const base = process.env.API_URL || "http://127.0.0.1:3001";
const modeArg = process.argv[2] || "invite_only";

if (!secret) {
  console.error(
    "Missing STUDENT_VERIFY_DEV_SECRET in .env — add e.g. STUDENT_VERIFY_DEV_SECRET=dev-secret\n" +
      "Start server with the same env: node server.js"
  );
  process.exit(1);
}

const bodies = {
  invite_only: JSON.stringify({
    mode: "invite_only",
    inviteCode: "state-demo-invite-only",
  }),
  domain: JSON.stringify({
    email: "you@student.demo-state.edu",
    inviteCode: "pilot2026",
  }),
};

const body = bodies[modeArg];
if (!body) {
  console.error("Usage: node scripts/test-student-verify.mjs [invite_only|domain]");
  process.exit(1);
}

const url = `${base.replace(/\/$/, "")}/api/student-verify-university`;

let res;
try {
  res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Student-Verify-Dev": secret,
    },
    body,
  });
} catch (e) {
  console.error(`Request to ${url} failed — start the API server (node server.js on 3001)?`);
  console.error(e?.message || e);
  process.exit(1);
}

const text = await res.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  parsed = text;
}

console.log(res.status, typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2));
