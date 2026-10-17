"use server";

import { revalidatePath } from "next/cache";
import { getCommittee, getCompletionFacts, isUuid, requireUser } from "@/lib/dal";
import { SETTLEMENT_NOTE_MAX, completeProblems } from "@/lib/committee";
import { todayInPakistan } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export type CompleteState = { problems: string[]; error: string | null; completed: boolean };

const PREFIX = "Cannot complete yet: ";

/**
 * Finishes a committee (running to completed). The app checks first so the organiser gets every problem in plain words,
 * but the database checks again and has the last word. After this the whole record is read-only.
 */
export async function completeCommittee(_previous: CompleteState, formData: FormData): Promise<CompleteState> {
  await requireUser();
  const id = String(formData.get("committeeId") ?? "");
  const c = isUuid(id) ? await getCommittee(id) : null;
  if (!c) return { problems: [], error: "That committee was not found.", completed: false };

  const note = String(formData.get("settlementNote") ?? "").trim();
  if ([...note].length > SETTLEMENT_NOTE_MAX) return { problems: [], error: `Keep the note to ${SETTLEMENT_NOTE_MAX} characters or fewer.`, completed: false };

  const facts = await getCompletionFacts(id, c.periods);
  if (!facts) return { problems: [], error: "We couldn't check the committee. Check the connection and try again.", completed: false };
  const problems = completeProblems(
    { status: c.status, amount: c.amount, periods: c.periods, startDate: c.start_date, dueDay: c.due_day, orderMethod: c.order_method, slots: facts.slots },
    todayInPakistan(),
    facts.unrecorded,
    note === "" ? null : note,
  );
  if (problems.length > 0) return { problems, error: null, completed: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_committee", { p_committee_id: id, p_settlement_note: note === "" ? null : note });
  if (error) {
    if (error.code === "P0001" && error.message.startsWith(PREFIX)) {
      return { problems: error.message.slice(PREFIX.length).split("; "), error: null, completed: false };
    }
    if (error.code === "P0001" && error.message !== "Not allowed") return { problems: [], error: error.message, completed: false };
    console.error("complete_committee failed:", error.code, error.message);
    return { problems: [], error: "We couldn't complete the committee. Nothing was changed. Check the connection and try again.", completed: false };
  }

  revalidatePath(`/committees/${id}`);
  revalidatePath(`/committees/${id}/members`);
  revalidatePath(`/committees/${id}/turns`);
  revalidatePath("/committees");
  return { problems: [], error: null, completed: true };
}
