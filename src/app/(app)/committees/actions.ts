"use server";

import { redirect } from "next/navigation";
import { DEFAULT_INPUT, validateAgreement, type AgreementInput, type AgreementProblems } from "@/lib/agreement";
import { requireUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

export type CreateState = { error: string | null; problems: AgreementProblems };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function readAgreement(formData: FormData): AgreementInput {
  return {
    name: text(formData, "name"),
    amount: text(formData, "amount"),
    periods: text(formData, "periods"),
    startDate: text(formData, "startDate"),
    dueDay: text(formData, "dueDay"),
    graceDays: text(formData, "graceDays"),
    orderMethod: text(formData, "orderMethod"),
    remindBeforeDays: text(formData, "remindBeforeDays"),
    remindLateEvery: text(formData, "remindLateEvery"),
    displayStyle: text(formData, "displayStyle"),
    displayGrouping: text(formData, "displayGrouping"),
    membersSeePayments: formData.get("membersSeePayments") === "on",
    membersSeeTurns: formData.get("membersSeeTurns") === "on",
    membersSeeHistory: formData.get("membersSeeHistory") === "on",
  };
}

/**
 * Runs on the server when the guided flow is finished. The answers are checked again here (the browser's check
 * is only a convenience), then saved through the database's own functions, which also write the history entry.
 */
export async function createCommittee(_previous: CreateState, formData: FormData): Promise<CreateState> {
  await requireUser();
  const { agreement: a, problems } = validateAgreement(readAgreement(formData));
  if (!a) return { error: null, problems };

  const supabase = await createClient();
  const created = await supabase.rpc("create_committee", {
    p_name: a.name,
    p_amount: a.amount,
    p_periods: a.periods,
    p_start_date: a.startDate,
    p_due_day: a.dueDay,
    p_grace_days: a.graceDays,
    p_order_method: a.orderMethod,
  });
  if (created.error || typeof created.data !== "string") {
    console.error("create_committee failed:", created.error?.code, created.error?.message);
    return { error: "We couldn't save the committee. Nothing was created. Check the connection and try again.", problems: {} };
  }
  const id = created.data;

  // The rest of the agreement. Only sent when it differs from what a new committee starts with,
  // so a committee created with the defaults has one history entry, not three.
  const d = DEFAULT_INPUT;
  const changedSettings =
    a.remindBeforeDays !== Number(d.remindBeforeDays) ||
    a.remindLateEvery !== Number(d.remindLateEvery) ||
    a.displayStyle !== d.displayStyle ||
    a.displayGrouping !== d.displayGrouping;
  const changedVisibility = a.membersSeePayments || a.membersSeeTurns || a.membersSeeHistory;
  let partial = false;

  if (changedSettings) {
    const r = await supabase.rpc("update_settings", {
      p_committee_id: id,
      p_name: a.name,
      p_amount: a.amount,
      p_periods: a.periods,
      p_start_date: a.startDate,
      p_due_day: a.dueDay,
      p_grace_days: a.graceDays,
      p_order_method: a.orderMethod,
      p_remind_before_days: a.remindBeforeDays,
      p_remind_late_every: a.remindLateEvery,
      p_display_style: a.displayStyle,
      p_display_grouping: a.displayGrouping,
    });
    if (r.error) {
      console.error("update_settings failed:", r.error.code, r.error.message);
      partial = true;
    }
  }
  if (changedVisibility) {
    const r = await supabase.rpc("set_visibility", {
      p_committee_id: id,
      p_payments: a.membersSeePayments,
      p_turns: a.membersSeeTurns,
      p_history: a.membersSeeHistory,
    });
    if (r.error) {
      console.error("set_visibility failed:", r.error.code, r.error.message);
      partial = true;
    }
  }

  redirect(`/committees/${id}${partial ? "?saved=partly" : "?created=1"}`);
}
