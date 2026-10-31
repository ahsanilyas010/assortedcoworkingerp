import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  // Surface misconfiguration early instead of failing on the first query.
  console.error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set");
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const RECEIPTS_BUCKET = "cw-receipts";
