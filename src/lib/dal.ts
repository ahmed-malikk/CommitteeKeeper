import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SIGN_IN_PATH } from "@/lib/access";
import type { PaidRecord } from "@/lib/payments";
import { holderLabel, type DrawEvent, type HolderStretch, type SwapEvent, type Turn } from "@/lib/turns";

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

/**
 * Every slot of a committee with who holds it (and for which periods), for the Turns page.
 * Null when the database could not be reached, so the page can say so instead of showing an empty list.
 */
export const getTurns = cache(async (committeeId: string, periods: number): Promise<Turn[] | null> => {
  const supabase = await createClient();
  const [slots, holders] = await Promise.all([
    supabase.from("slots").select("id, position, paid_out, created_at").eq("committee_id", committeeId).order("created_at"),
    supabase
      .from("slot_holders")
      .select("slot_id, member_id, from_period, to_period, members(name), slots!inner(committee_id)")
      .eq("slots.committee_id", committeeId)
      .order("from_period"),
  ]);
  if (slots.error || holders.error) return null;

  const bySlot = new Map<string, HolderStretch[]>();
  for (const h of holders.data ?? []) {
    const member = h.members as unknown as { name: string } | null;
    const list = bySlot.get(h.slot_id) ?? [];
    list.push({ memberId: h.member_id, name: member?.name ?? "Unknown", fromPeriod: h.from_period, toPeriod: h.to_period });
    bySlot.set(h.slot_id, list);
  }

  // A member with two slots would show the same name twice, so later ones get "slot 2", "slot 3".
  const seen = new Map<string, number>();
  return (slots.data ?? []).map((s) => {
    const stretches = bySlot.get(s.id) ?? [];
    let label = holderLabel(stretches, periods);
    const first = stretches[0]?.name;
    if (first) {
      const n = (seen.get(first) ?? 0) + 1;
      seen.set(first, n);
      if (n > 1) label = `${label} · slot ${n}`;
    }
    return { id: s.id, position: s.position as number | null, paidOut: s.paid_out as boolean, holders: stretches, label };
  });
});

/** The draw entries of the committee's history, oldest first. Null when the database could not be reached. */
export const getDrawHistory = cache(async (committeeId: string): Promise<DrawEvent[] | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_events")
    .select("seq, type, happened_on, payload")
    .eq("committee_id", committeeId)
    .in("type", ["draw_done", "draw_redone"])
    .order("seq");
  if (error) return null;
  return (data ?? []).map((e) => ({ seq: e.seq, type: e.type, happenedOn: e.happened_on, payload: (e.payload ?? {}) as DrawEvent["payload"] }));
});

/** The swaps in the committee's history, oldest first. Null when the database could not be reached. */
export const getSwapHistory = cache(async (committeeId: string): Promise<SwapEvent[] | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_events")
    .select("seq, happened_on, payload")
    .eq("committee_id", committeeId)
    .eq("type", "turn_swapped")
    .order("seq");
  if (error) return null;
  return (data ?? []).map((e) => ({ seq: e.seq, happenedOn: e.happened_on, payload: (e.payload ?? {}) as SwapEvent["payload"] }));
});

/** How many instalments have a payment recorded that counts (a corrected or cancelled one is not counted). Null when the database could not be reached. */
export const getRecordedPaymentCount = cache(async (committeeId: string): Promise<number | null> => {
  const supabase = await createClient();
  const { count, error } = await supabase.from("payments_current").select("id", { count: "exact", head: true }).eq("committee_id", committeeId);
  return error ? null : (count ?? 0);
});

/** The committee's slots plus how many payments are still unrecorded, in the shape `completeProblems` expects. */
export async function getCompletionFacts(committeeId: string, periods: number) {
  const [slots, recorded] = await Promise.all([getSlotInfo(committeeId), getRecordedPaymentCount(committeeId)]);
  if (!slots || recorded === null) return null;
  // Every slot pays every period, so periods x periods instalments are expected in all (same rule as the database).
  return { slots, unrecorded: Math.max(0, periods * periods - recorded) };
}

export type PaymentFacts = {
  slotIds: string[];
  paid: PaidRecord[];
  /** Who holds each slot, with the periods they held it (needed to name the payer of a given period). */
  holders: Map<string, HolderStretch[]>;
};

/**
 * Slots, counted payments and holders for several committees at once (the home screen), keyed by committee.
 * Null when the database could not be reached. Row-level security limits every query to the organiser's own committees.
 */
export async function getPaymentFacts(committeeIds: string[]): Promise<Map<string, PaymentFacts> | null> {
  const facts = new Map<string, PaymentFacts>(committeeIds.map((id) => [id, { slotIds: [], paid: [], holders: new Map() }]));
  if (committeeIds.length === 0) return facts;
  const supabase = await createClient();
  const [slots, payments, holders] = await Promise.all([
    supabase.from("slots").select("id, committee_id, created_at").in("committee_id", committeeIds).order("created_at"),
    supabase.from("payments_current").select("committee_id, slot_id, period, paid_on").in("committee_id", committeeIds),
    supabase
      .from("slot_holders")
      .select("slot_id, member_id, from_period, to_period, members(name), slots!inner(committee_id)")
      .in("slots.committee_id", committeeIds)
      .order("from_period"),
  ]);
  if (slots.error || payments.error || holders.error) return null;

  const committeeOfSlot = new Map<string, string>();
  for (const s of slots.data ?? []) {
    facts.get(s.committee_id)?.slotIds.push(s.id);
    committeeOfSlot.set(s.id, s.committee_id);
  }
  for (const p of payments.data ?? []) facts.get(p.committee_id)?.paid.push({ slotId: p.slot_id, period: p.period, paidOn: p.paid_on });
  for (const h of holders.data ?? []) {
    const f = facts.get(committeeOfSlot.get(h.slot_id) ?? "");
    if (!f) continue;
    const member = h.members as unknown as { name: string } | null;
    const list = f.holders.get(h.slot_id) ?? [];
    list.push({ memberId: h.member_id, name: member?.name ?? "Unknown", fromPeriod: h.from_period, toPeriod: h.to_period });
    f.holders.set(h.slot_id, list);
  }
  return facts;
}

/** The name of whoever held a slot in a given period. */
export function payerName(holders: Map<string, HolderStretch[]>, slotId: string, period: number): string {
  const h = (holders.get(slotId) ?? []).find((s) => s.fromPeriod <= period && (s.toPeriod === null || s.toPeriod >= period));
  return h?.name ?? "Unknown";
}

export type PaymentRow = { id: string; slotId: string; memberId: string; period: number; paidOn: string; method: string };

/** The payments of one committee that count (corrected or cancelled ones are left out). Null when the database could not be reached. */
export const getPayments = cache(async (committeeId: string): Promise<PaymentRow[] | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payments_current")
    .select("id, slot_id, member_id, period, paid_on, method")
    .eq("committee_id", committeeId)
    .order("period")
    .order("paid_on");
  if (error) return null;
  return (data ?? []).map((p) => ({ id: p.id, slotId: p.slot_id, memberId: p.member_id, period: p.period, paidOn: p.paid_on, method: p.method }));
});
