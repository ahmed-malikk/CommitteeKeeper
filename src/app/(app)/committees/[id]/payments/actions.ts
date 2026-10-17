"use server";

import { getCommittee, isUuid, requireUser } from "@/lib/dal";
import { explainDbError } from "@/lib/db-errors";
import { todayInPakistan } from "@/lib/dates";
import { paymentProblems, type PaymentProblems } from "@/lib/payments";
import { refreshPayments } from "@/lib/refresh";
import { createClient } from "@/lib/supabase/server";

/** `done` goes up by one each time a payment is saved, so the form knows to clear itself. */
export type PayState = { error: string | null; problems: PaymentProblems; paymentId: string | null; done: number };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/**
 * Records that a slot paid its full instalment for a period (rule M5: the amount is never typed in).
 * The app checks first so every problem is explained next to its field; the database checks again and has the last word.
 */
export async function recordPayment(previous: PayState, formData: FormData): Promise<PayState> {
  await requireUser();
  const fail = (error: string | null, problems: PaymentProblems = {}): PayState => ({ error, problems, paymentId: null, done: previous.done });

  const id = text(formData, "committeeId");
  const c = isUuid(id) ? await getCommittee(id) : null;
  if (!c) return fail("That committee was not found.");
  if (c.status !== "running") return fail("Payments can only be recorded while the committee is running.");

  const input = {
    slotId: text(formData, "slotId"),
    period: Number(text(formData, "period")),
    paidOn: text(formData, "paidOn"),
    method: text(formData, "method"),
    note: text(formData, "note"),
  };
  if (input.slotId !== "" && !isUuid(input.slotId)) return fail("That slot was not found. Refresh the page and try again.");
  const problems = paymentProblems(input, c.periods, todayInPakistan());
  if (Object.keys(problems).length > 0) return fail(null, problems);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    p_committee_id: id,
    p_slot_id: input.slotId,
    p_period: input.period,
    p_paid_on: input.paidOn,
    p_method: input.method,
    p_note: input.note.trim() === "" ? undefined : input.note.trim(),
  });
  if (error) return fail(explainDbError(error, "record the payment"));

  refreshPayments(id);
  return { error: null, problems: {}, paymentId: data as string, done: previous.done + 1 };
}
