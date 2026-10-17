"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCommittee, isUuid, requireUser } from "@/lib/dal";
import { validateMember, validateSlotCount, type MemberProblems } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";

/** `done` goes up by one each time an action succeeds, so a form knows when to clear itself. */
export type MemberState = { error: string | null; problems: MemberProblems; done: number };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const fail = (error: string, problems: MemberProblems = {}, previous?: MemberState): MemberState => ({ error, problems, done: previous?.done ?? 0 });
const ok = (previous: MemberState): MemberState => ({ error: null, problems: {}, done: previous.done + 1 });

/**
 * The database's own refusals are written for people ("This committee already has as many slots as periods"),
 * so they are shown as they are. Anything else (a lost connection, a bug) gets a plain sentence and a log line.
 */
function explain(error: { code?: string; message: string }, doing: string): string {
  if (error.code === "P0001" && error.message !== "Not allowed") return error.message;
  console.error(`${doing} failed:`, error.code, error.message);
  return `We couldn't ${doing}. Nothing was changed. Check the connection and try again.`;
}

function refresh(committeeId: string) {
  revalidatePath(`/committees/${committeeId}`);
  revalidatePath(`/committees/${committeeId}/members`);
  revalidatePath("/committees");
}

async function open(formData: FormData) {
  await requireUser();
  const id = text(formData, "committeeId");
  const committee = isUuid(id) ? await getCommittee(id) : null;
  return committee ? { id, committee } : null;
}

export async function addMember(previous: MemberState, formData: FormData): Promise<MemberState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", {}, previous);
  const { id, committee } = target;

  const { clean, problems } = validateMember({ name: text(formData, "name"), email: text(formData, "email"), phone: text(formData, "phone") });
  const supabase = await createClient();

  // Slots are only given out while the committee is forming; once it runs, a new member has none.
  let wanted = 0;
  if (committee.status === "forming") {
    const { count } = await supabase.from("slots").select("id", { count: "exact", head: true }).eq("committee_id", id);
    const slotProblem = validateSlotCount(text(formData, "slots") || "1", committee.periods - (count ?? 0));
    if (slotProblem) problems.slots = slotProblem;
    else wanted = Number(text(formData, "slots") || "1");
  }
  if (!clean || problems.slots) return fail("", problems, previous);

  const created = await supabase.rpc("add_member", { p_committee_id: id, p_name: clean.name, p_email: clean.email || null, p_phone: clean.phone || null });
  if (created.error || typeof created.data !== "string") return fail(explain(created.error ?? { message: "no id" }, "add the member"), {}, previous);

  for (let i = 0; i < wanted; i++) {
    const slot = await supabase.rpc("add_slot", { p_committee_id: id, p_member_id: created.data });
    if (slot.error) {
      refresh(id);
      return fail(`${clean.name} was added, but a slot could not be: ${explain(slot.error, "add the slot")} Add the slot from the list below.`, {}, previous);
    }
  }
  refresh(id);
  return ok(previous);
}

export async function editMember(previous: MemberState, formData: FormData): Promise<MemberState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", {}, previous);
  const memberId = text(formData, "memberId");
  if (!isUuid(memberId)) return fail("That member was not found.", {}, previous);

  const { clean, problems } = validateMember({ name: text(formData, "name"), email: text(formData, "email"), phone: text(formData, "phone") });
  if (!clean) return fail("", problems, previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_member", {
    p_committee_id: target.id,
    p_member_id: memberId,
    p_name: clean.name,
    p_email: clean.email || null,
    p_phone: clean.phone || null,
  });
  if (error) return fail(explain(error, "save the changes"), {}, previous);
  refresh(target.id);
  return ok(previous);
}

export async function removeMember(previous: MemberState, formData: FormData): Promise<MemberState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", {}, previous);
  const memberId = text(formData, "memberId");
  if (!isUuid(memberId)) return fail("That member was not found.", {}, previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_committee_id: target.id, p_member_id: memberId });
  if (error) return fail(explain(error, "remove the member"), {}, previous);
  refresh(target.id);
  return ok(previous);
}

export async function addSlot(previous: MemberState, formData: FormData): Promise<MemberState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", {}, previous);
  const memberId = text(formData, "memberId");
  if (!isUuid(memberId)) return fail("That member was not found.", {}, previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_slot", { p_committee_id: target.id, p_member_id: memberId });
  if (error) return fail(explain(error, "add the slot"), {}, previous);
  refresh(target.id);
  return ok(previous);
}

/** Takes away the member's newest slot (the database removes a slot by its own id). */
export async function removeSlot(previous: MemberState, formData: FormData): Promise<MemberState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", {}, previous);
  const memberId = text(formData, "memberId");
  if (!isUuid(memberId)) return fail("That member was not found.", {}, previous);

  const supabase = await createClient();
  const { data: held } = await supabase.from("slot_holders").select("slot_id, slots!inner(created_at, committee_id)").eq("member_id", memberId).eq("slots.committee_id", target.id);
  const newest = (held ?? []).map((h) => ({ id: h.slot_id as string, at: String((h.slots as unknown as { created_at: string }).created_at) })).sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!newest) return fail("This member has no slot to remove.", {}, previous);

  const { error } = await supabase.rpc("remove_slot", { p_committee_id: target.id, p_slot_id: newest.id });
  if (error) return fail(explain(error, "remove the slot"), {}, previous);
  refresh(target.id);
  return ok(previous);
}

/**
 * A member leaves and a replacement takes over one slot from a later period (rules L1 to L3). The database checks that the
 * leaver has no payments recorded from that period on; the split of the pot is worked out by `splitPot` when it is paid out.
 */
export async function replaceHolder(previous: MemberState, formData: FormData): Promise<MemberState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", {}, previous);
  const slotId = text(formData, "slotId");
  const memberId = text(formData, "memberId");
  if (!isUuid(slotId) || !isUuid(memberId)) return fail("Choose the slot and the replacement.", {}, previous);
  const fromPeriod = Number(text(formData, "fromPeriod"));
  if (!Number.isInteger(fromPeriod) || fromPeriod < 2 || fromPeriod > target.committee.periods) {
    return fail(`Choose a period from 2 to ${target.committee.periods}.`, {}, previous);
  }
  const reason = text(formData, "reason").trim();
  if ([...reason].length > 200) return fail("Keep the reason to 200 characters or fewer.", {}, previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("replace_holder", {
    p_committee_id: target.id,
    p_slot_id: slotId,
    p_new_member_id: memberId,
    p_from_period: fromPeriod,
    p_reason: reason === "" ? null : reason,
  });
  if (error) return fail(explain(error, "hand the slot over"), {}, previous);
  refresh(target.id);
  revalidatePath(`/committees/${target.id}/turns`);
  redirect(`/committees/${target.id}/members?replaced=1`);
}
