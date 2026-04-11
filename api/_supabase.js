/**
 * api/_supabase.js
 * ----------------
 * Shared Supabase admin client for Vercel serverless functions.
 * Uses the service-role key so it bypasses RLS (server-side only).
 *
 * Env vars required (set in Vercel dashboard):
 *   SUPABASE_URL          — https://<project>.supabase.co
 *   SUPABASE_SERVICE_KEY  — service_role key (not the anon key)
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("SUPABASE_URL or SUPABASE_SERVICE_KEY not set — database calls will fail");
}

export const supabase = createClient(supabaseUrl || "", supabaseKey || "", {
  auth: { persistSession: false },
});
