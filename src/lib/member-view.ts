import { periodLabel } from "./payments";

// What the database's member_view / member_home functions return, as types, plus one parser.
// The database decides what a member may see (migration 005); this file only reads that answer.

export type MemberSlot = { slot_id: string; position: number | null; paid_out: boolean; stretches: { from: number; to: number | null }[] | null };
export type MemberPayment = { payment_id: string; slot_id: string; period: number; amount: number; paid_on: string; method: string; receipts: number };

export type MemberView = {
  committee: {
    name: string;
    status: "forming" | "running" | "completed";
    amount: number;
    periods: number;
    start_date: string;
    due_day: number;
    grace_days: number;
    display_style: "rs" | "rs_dash";
    display_grouping: "western" | "lakh";
  };
  me: { member_id: string; name: string };
  current_period: number;
  periods_left: number;
  my_slots: MemberSlot[];
  my_payments: MemberPayment[];
  /** Present only when the organiser allows members to see the order of turns. */
  all_turns?: { position: number | null; paid_out: boolean; holder: string; is_me: boolean }[];
  /** Present only when the organiser allows members to see who has paid this month. */
  payment_status?: { holder: string; is_me: boolean; paid: boolean }[];
  /** Present only when the organiser allows members to see history entries about them. */
  history?: { seq: number; type: string; happened_on: string }[];
};

/** The answer for a link that does not work is an empty object; anything without a committee and a member is treated as that. */
export function parseMemberView(value: unknown): MemberView | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Partial<MemberView>;
  if (!v.committee || !v.me || !Array.isArray(v.my_slots) || !Array.isArray(v.my_payments)) return null;
  return v as MemberView;
}

/** Tokens are 43 URL-safe characters; anything else can't be one, so it is refused without asking the database. */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

/** One line about where the committee is, for the top of the member page. */
export function progressText(v: Pick<MemberView, "committee" | "current_period" | "periods_left">): string {
  const { status, periods, start_date } = v.committee;
  if (status === "completed") return "This committee is completed.";
  if (status === "forming" || v.current_period === 0) return `Not started yet. It runs for ${periods} months from ${periodLabel(start_date, 1)}.`;
  if (v.periods_left === 0) return `This is the last month (${v.current_period} of ${periods}).`;
  return `Month ${v.current_period} of ${periods}. ${v.periods_left} month${v.periods_left === 1 ? "" : "s"} left after this one.`;
}

/** Where one of my turns stands, in words: when the pot comes to me, and whether I only covered some months of it. */
export function turnText(slot: MemberSlot, start: string): string {
  const place = slot.position === null ? "Your place in the order is not set yet." : `Turn ${slot.position}: the pot comes to you in ${periodLabel(start, slot.position)}${slot.paid_out ? " (paid out)" : ""}.`;
  const ended = (slot.stretches ?? []).filter((x) => x.to !== null);
  if (ended.length === 0) return place;
  const covered = ended.map((x) => (x.from === x.to ? `month ${x.from}` : `months ${x.from} to ${x.to}`)).join(" and ");
  return `${place} You were responsible for ${covered} of it; someone else took over after that.`;
}

const TYPE_WORDS: Record<string, string> = {
  member_invited: "You were added to the committee",
  agreement_accepted: "You accepted the agreement",
  slot_added: "You were given a slot",
  slot_removed: "A slot of yours was removed",
  payment_recorded: "A payment of yours was recorded",
  payment_corrected: "A payment of yours was corrected",
  receipt_attached: "A receipt was added to a payment of yours",
  receipt_removed: "A receipt was removed from a payment of yours",
  holder_replaced: "A slot of yours changed hands",
  payout_recorded: "A pot was handed to you",
};

/** The type of a history entry about the member, in words they would use. Only the type and date are ever shown to a member. */
export function historyWords(type: string): string {
  return TYPE_WORDS[type] ?? "Something changed that involves you";
}
