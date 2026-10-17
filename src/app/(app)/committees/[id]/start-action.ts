"use server";

import { revalidatePath } from "next/cache";
import { getCommittee, getSlotInfo, isUuid, requireUser } from "@/lib/dal";
import { startProblems } from "@/lib/committee";
import { createClient } from "@/lib/supabase/server";

export type StartState = { problems: string[]; error: string | null; started: boolean };

const PREFIX = "Cannot start yet: ";

/**
 * Starts a committee (forming to running). The app checks first so the organiser gets every problem in plain words,
 * but the database checks again and has the last word: it refuses a start that is not ready, whatever the app says.
 */
export async function startCommittee(_previous: StartState, formData: FormData): Promise<StartState> {
  await requireUser();
  const id = String(formData.get("committeeId") ?? "");
  const c = isUuid(id) ? await getCommittee(id) : null;
  if (!c) return { problems: [], error: "That committee was not found.", started: false };

  const slots = await getSlotInfo(id);
  if (!slots) return { problems: [], error: "We couldn't check the committee. Check the connection and try again.", started: false };
  const problems = startProblems({
    status: c.status,
    amount: c.amount,
    periods: c.periods,
    startDate: c.start_date,
    dueDay: c.due_day,
    orderMethod: c.order_method,
    slots,
  });
  if (problems.length > 0) return { problems, error: null, started: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("start_committee", { p_committee_id: id });
  if (error) {
    // The database's own list ("Cannot start yet: a; b") becomes a list again.
    if (error.code === "P0001" && error.message.startsWith(PREFIX)) {
      return { problems: error.message.slice(PREFIX.length).split("; "), error: null, started: false };
    }
    if (error.code === "P0001" && error.message !== "Not allowed") return { problems: [], error: error.message, started: false };
    console.error("start_committee failed:", error.code, error.message);
    return { problems: [], error: "We couldn't start the committee. Nothing was changed. Check the connection and try again.", started: false };
  }

  revalidatePath(`/committees/${id}`);
  revalidatePath(`/committees/${id}/members`);
  revalidatePath("/committees");
  return { problems: [], error: null, started: true };
}
