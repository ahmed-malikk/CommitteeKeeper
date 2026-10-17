import "server-only";
import { revalidatePath } from "next/cache";

/** After anything about money changes, every screen that shows it is asked to load fresh data. */
export function refreshPayments(committeeId: string) {
  revalidatePath(`/committees/${committeeId}`);
  revalidatePath(`/committees/${committeeId}/payments`);
  revalidatePath("/committees");
}
