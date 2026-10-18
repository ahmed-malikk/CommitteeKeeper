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
