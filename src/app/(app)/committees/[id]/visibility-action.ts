"use server";

import { revalidatePath } from "next/cache";
import { getCommittee, isUuid, requireUser } from "@/lib/dal";
import { explainDbError } from "@/lib/db-errors";
import { createClient } from "@/lib/supabase/server";

export type VisibilityResult = { error: string | null };

/**
 * Saves what members may see (all three off by default). It applies to every member screen at once, because the member
 * pages read these settings from the database each time they open. The change is written to the history.
 */
export async function setVisibility(committeeId: string, payments: boolean, turns: boolean, history: boolean): Promise<VisibilityResult> {
  await requireUser();
  const c = isUuid(committeeId) ? await getCommittee(committeeId) : null;
  if (!c) return { error: "That committee was not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_visibility", { p_committee_id: committeeId, p_payments: payments, p_turns: turns, p_history: history });
  if (error) return { error: explainDbError(error, "save what members can see") };
  revalidatePath(`/committees/${committeeId}`);
  revalidatePath(`/committees/${committeeId}/history`);
  return { error: null };
}
