import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * The server-only client (decision 1, 17 Oct): it uses the secret key, which bypasses row-level security, so it is
 * used by exactly two routes: the daily reminder job and the receipt links for members who have no account.
 * The key lives only in .env.local and in Vercel's environment variables. Returns null when it is not set.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
