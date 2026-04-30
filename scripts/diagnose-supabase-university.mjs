/**
 * Calls PostgREST the same way the app does — verifies university_* tables are visible.
 * Uses SUPABASE_URL + SUPABASE_SERVICE_KEY from .env
 *
 *   npm run diagnose:supabase-university
 */

import dotenv from "dotenv";

dotenv.config({ quiet: true });

const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env");
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("Invalid SUPABASE_URL");
  process.exit(1);
}

async function checkRest(table) {
  const res = await fetch(`${url}/rest/v1/${encodeURIComponent(table)}?select=id&limit=1`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      Prefer: "count=exact",
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

console.log("SUPABASE_URL host:", host);
console.log("");

for (const t of ["universities", "university_invite_codes", "university_student_verifications"]) {
  const { status, body } = await checkRest(t);
  const snippet =
    typeof body === "object" && body !== null
      ? JSON.stringify(body).slice(0, 280)
      : String(body).slice(0, 280);
  console.log(`${t}: HTTP ${status}`, snippet);
}

console.log("");
console.log(
  "If you see PGRST205 / schema cache: run in SQL Editor — NOTIFY pgrst, 'reload schema'; — then retry."
);
