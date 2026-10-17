import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SIGN_IN_PATH } from "@/lib/access";

export type Organiser = { id: string; email: string };

/**
 * Who is signed in (or null). `cache` means one page render asks only once, however many components call it.
 * getClaims() checks the login token's signature here without a network trip, so a forged or expired cookie fails.
 */
export const getCurrentUser = cache(async (): Promise<Organiser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

/** Call at the top of every organiser page or layout: sends anyone who isn't signed in to the sign-in page. */
export async function requireUser(): Promise<Organiser> {
  const user = await getCurrentUser();
  if (!user) redirect(SIGN_IN_PATH);
  return user;
}
