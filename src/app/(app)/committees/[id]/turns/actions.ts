"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCommittee, isUuid, requireUser } from "@/lib/dal";
import { explainDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

/** `done` goes up by one each time an action succeeds, so a form knows when to clear itself. */
export type TurnState = { error: string | null; done: number };

const REASON_MAX = 200;
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");
const fail = (error: string, previous: TurnState): TurnState => ({ error, done: previous.done });

function refresh(committeeId: string) {
  revalidatePath(`/committees/${committeeId}`);
  revalidatePath(`/committees/${committeeId}/turns`);
  revalidatePath("/committees");
}

/** The organiser's own committee, or null. Everything below starts here. */
async function open(formData: FormData) {
  await requireUser();
  const id = text(formData, "committeeId");
  const committee = isUuid(id) ? await getCommittee(id) : null;
  return committee ? { id, committee } : null;
}

/** The optional reason, trimmed; null when empty. Returns "too long" as a string error instead. */
function reasonOf(formData: FormData): { reason: string | null; problem: string | null } {
  const reason = text(formData, "reason").trim();
  if ([...reason].length > REASON_MAX) return { reason: null, problem: `Keep the reason to ${REASON_MAX} characters or fewer.` };
  return { reason: reason === "" ? null : reason, problem: null };
}

/** Saves the turn order the organiser arranged by hand (rule O1). The database checks that every unpaid turn is listed once. */
export async function saveOrder(previous: TurnState, formData: FormData): Promise<TurnState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", previous);

  let ids: unknown;
  try {
    ids = JSON.parse(text(formData, "order"));
  } catch {
    ids = null;
  }
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((x) => typeof x === "string" && isUuid(x))) {
    return fail("The order could not be read. Refresh the page and try again.", previous);
  }
  const { reason, problem } = reasonOf(formData);
  if (problem) return fail(problem, previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order", { p_committee_id: target.id, p_slot_ids: ids as string[], p_reason: reason });
  if (error) return fail(explainDbError(error, "save the order"), previous);
  refresh(target.id);
  // The page shows the "saved" note itself; a note kept in the form would be lost when the page refreshes.
  redirect(`/committees/${target.id}/turns?saved=order`);
}
