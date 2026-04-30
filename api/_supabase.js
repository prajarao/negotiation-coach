/**
 * api/_supabase.js
 * ----------------
 * Shared Supabase admin client for Vercel serverless functions.
 * Uses the service-role key so it bypasses RLS (server-side only).
 *
 * Env vars required (set in Vercel dashboard):
 *   SUPABASE_URL               — https://<project-ref>.supabase.co (Project Settings → API)
 *   SUPABASE_SERVICE_KEY       — service_role key (not the anon key)
 *   SUPABASE_ALLOW_CUSTOM_URL   — optional "1" if using a non-standard API host (advanced)
 *
 * Note: We call `dotenv.config({ quiet: true })` before reading process.env so local `node server.js`
 * picks up `.env` even though other imports are evaluated before server.js runs (ESM hoisting).
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ quiet: true });
const supabaseUrlRaw = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

/** Project REST URL must be https://<project-ref>.supabase.co — not Studio (supabase.com/dashboard/...) */
function isSupabaseProjectApiUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (process.env.SUPABASE_ALLOW_CUSTOM_URL === "1") return true;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    const parts = host.split(".");
    return parts.length === 3 && parts[1] === "supabase" && parts[2] === "co";
  } catch {
    return false;
  }
}

const urlLooksWrong =
  Boolean(supabaseUrlRaw && supabaseKey && !isSupabaseProjectApiUrl(supabaseUrlRaw));

if (!supabaseUrlRaw || !supabaseKey) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_KEY not set — database calls will fail");
} else if (urlLooksWrong) {
  console.warn(
    "SUPABASE_URL must be your Project URL (https://xxxx.supabase.co). " +
      "Copy it from Dashboard → Project Settings → API — not the Studio or supabase.com/dashboard link."
  );
}

const supabaseUrl = supabaseUrlRaw?.trim()?.replace(/\/+$/, "") || "";

/** Set when credentials exist but SUPABASE_URL is not the *.supabase.co API endpoint */
export const supabaseUrlMisconfigured = urlLooksWrong;

/** @type {import("@supabase/supabase-js").SupabaseClient | null} */
export const supabase =
  supabaseUrl && supabaseKey && !urlLooksWrong && isSupabaseProjectApiUrl(supabaseUrl)
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false },
      })
    : null;
