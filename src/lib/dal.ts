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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (text: string) => UUID.test(text);

/**
 * One committee of the signed-in organiser, or null. Someone else's committee is invisible to this query
 * (row-level security), so it looks exactly like one that does not exist. `cache` shares it within one page render.
 */
export const getCommittee = cache(async (id: string) => {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("committees").select("*").eq("id", id).maybeSingle();
  return data;
});

/** The committee's slots in the shape the rule checks in `committee.ts` expect: has a holder, has a place in the order, paid out. */
export const getSlotInfo = cache(async (committeeId: string) => {
  const supabase = await createClient();
  const [slots, holders] = await Promise.all([
    supabase.from("slots").select("id, position, paid_out").eq("committee_id", committeeId),
    supabase.from("slot_holders").select("slot_id, slots!inner(committee_id)").eq("slots.committee_id", committeeId),
  ]);
  if (slots.error || holders.error) return null;
  const held = new Set((holders.data ?? []).map((h) => h.slot_id));
  return (slots.data ?? []).map((s) => ({ hasHolder: held.has(s.id), position: s.position as number | null, paidOut: s.paid_out as boolean }));
});
