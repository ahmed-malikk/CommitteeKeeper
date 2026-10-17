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

/** "Draw all turns": the database picks the order with secure random bytes. Doing it again is a redo; the old result stays in the history. */
export async function drawAll(previous: TurnState, formData: FormData): Promise<TurnState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", previous);
  const { reason, problem } = reasonOf(formData);
  if (problem) return fail(problem, previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("draw_all", { p_committee_id: target.id, p_reason: reason });
  if (error) return fail(explainDbError(error, "draw the turns"), previous);
  refresh(target.id);
  redirect(`/committees/${target.id}/turns?saved=${text(formData, "redo") === "1" ? "redrawn" : "drawn"}`);
}

/** Month-by-month draw: picks one turn from those without a place. With `redo`, throws away the last drawn turn first. */
export async function drawNext(previous: TurnState, formData: FormData): Promise<TurnState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", previous);
  const redo = text(formData, "redo") === "1";
  const { reason, problem } = reasonOf(formData);
  if (problem) return fail(problem, previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("draw_next", { p_committee_id: target.id, p_redo: redo, p_reason: reason });
  if (error) return fail(explainDbError(error, redo ? "redo the draw" : "draw the next turn"), previous);
  refresh(target.id);
  redirect(`/committees/${target.id}/turns?saved=${redo ? "redrawn" : "drawn"}`);
}

const METHODS = ["hand", "draw_start", "draw_monthly"];

/** Changes how turns are decided (rule O3). Once the committee is running, the change needs a reason. */
export async function changeMethod(previous: TurnState, formData: FormData): Promise<TurnState> {
  const target = await open(formData);
  if (!target) return fail("That committee was not found.", previous);
  const method = text(formData, "method");
  if (!METHODS.includes(method)) return fail("Choose one of the ways of deciding turns.", previous);
  if (method === target.committee.order_method) return fail("That is already the way turns are decided.", previous);
  const { reason, problem } = reasonOf(formData);
  if (problem) return fail(problem, previous);
  if (target.committee.status === "running" && reason === null) return fail("Say why the way of deciding turns is changing. It is written to the history.", previous);

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_method", { p_committee_id: target.id, p_method: method, p_reason: reason });
  if (error) return fail(explainDbError(error, "change how turns are decided"), previous);
  refresh(target.id);
  redirect(`/committees/${target.id}/turns?saved=method`);
}
