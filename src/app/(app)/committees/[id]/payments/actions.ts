"use server";

import { getCommittee, isUuid, requireUser } from "@/lib/dal";
import { explainDbError } from "@/lib/db-errors";
import { todayInPakistan } from "@/lib/dates";
import { correctionProblems, paymentProblems, type CorrectionProblems, type PaymentProblems } from "@/lib/payments";
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

export type RemoveState = { error: string | null };

/**
 * Removes a receipt: the database marks it removed and writes the history entry (with the file's fingerprint),
 * then the image file itself is deleted from the private bucket (rule P5). The history keeps the record.
 */
export async function removeReceipt(committeeId: string, receiptId: string): Promise<RemoveState> {
  await requireUser();
  if (!isUuid(committeeId) || !isUuid(receiptId)) return { error: "That receipt was not found." };
  const c = await getCommittee(committeeId);
  if (!c) return { error: "That committee was not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_receipt", { p_committee_id: committeeId, p_receipt_id: receiptId });
  if (error) return { error: explainDbError(error, "remove the receipt") };

  const gone = await supabase.storage.from("receipts").remove([data as string]);
  // The record says it is removed either way; a file that could not be deleted is logged for the cleanup job.
  if (gone.error) console.error("receipt file not deleted:", data, gone.error.message);
  refreshPayments(committeeId);
  return { error: null };
}

export type CorrectState = { error: string | null; problems: CorrectionProblems; done: number };

/**
 * Corrects or cancels a payment. Nothing is edited: the database adds a new entry that points to the original, and the
 * original stays in the history (rule C1). The reason is required so the history says why. Cancelling voids the payment.
 */
export async function correctPayment(previous: CorrectState, formData: FormData): Promise<CorrectState> {
  await requireUser();
  const fail = (error: string | null, problems: CorrectionProblems = {}): CorrectState => ({ error, problems, done: previous.done });

  const id = text(formData, "committeeId");
  const paymentId = text(formData, "paymentId");
  const c = isUuid(id) ? await getCommittee(id) : null;
  if (!c || !isUuid(paymentId)) return fail("That payment was not found. Refresh the page and try again.");
  if (c.status !== "running") return fail("Payments can only be corrected while the committee is running.");

  const input = { paidOn: text(formData, "paidOn"), method: text(formData, "method"), note: text(formData, "note"), reason: text(formData, "reason"), cancel: text(formData, "cancel") === "yes" };
  const problems = correctionProblems(input, todayInPakistan());
  if (Object.keys(problems).length > 0) return fail(null, problems);

  const supabase = await createClient();
  const { error } = await supabase.rpc("correct_payment", {
    p_committee_id: id,
    p_payment_id: paymentId,
    p_paid_on: input.paidOn,
    p_method: input.method,
    p_note: input.note.trim() === "" ? undefined : input.note.trim(),
    p_cancel: input.cancel,
    p_reason: input.reason.trim(),
  });
  if (error) return fail(explainDbError(error, input.cancel ? "cancel the payment" : "correct the payment"));

  refreshPayments(id);
  return { error: null, problems: {}, done: previous.done + 1 };
}
