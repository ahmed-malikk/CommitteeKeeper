// The state machine for a committee (rules section 6). Pure functions: no database, no screen.
// The SQL functions in migrations 004a to 004c enforce the same rules; this file lets the app explain
// them in plain words before the database refuses.
import type { OrderMethod } from "./agreement";

export type Status = "forming" | "running" | "completed";

export type SlotInfo = {
  hasHolder: boolean;
  position: number | null; // turn order; null until it is set
  paidOut: boolean;
};

export type CommitteeInfo = {
  status: Status;
  amount: number; // whole rupees
  periods: number;
  startDate: string | null; // "YYYY-MM-DD"
  dueDay: number; // 1 to 28
  orderMethod: OrderMethod;
  slots: SlotInfo[];
};

export type Action =
  | "update_settings" | "add_slot" | "remove_slot" | "remove_member" | "start"
  | "add_member" | "update_member" | "set_visibility" | "set_order" | "set_order_method"
  | "record_agreement" | "set_member_link" | "draw_all"
  | "record_payment" | "correct_payment" | "attach_receipt" | "remove_receipt" | "record_payout"
  | "swap_turns" | "replace_holder" | "draw_next" | "complete";

// Task 1: may a committee move from one status to another?
// Idea: a lookup table says where each status may go next. No chain of ifs.
const MOVES: Record<Status, Status[]> = {
  forming: ["running"],
  running: ["completed"],
  completed: [],
};

export function canMove(from: Status, to: Status): boolean {
  return MOVES[from].includes(to);
}

// Task 2: what stops this committee from starting? An empty list means it may start.
export function startProblems(c: CommitteeInfo): string[] {
  if (c.status !== "forming") return ["A committee can only be started while it is forming"];

  const problems: string[] = [];
  if (c.amount <= 0) problems.push("Set the instalment amount");
  if (c.startDate === null) problems.push("Set the start date");
  if (c.slots.length < 2) problems.push("Add at least 2 slots");
  if (c.slots.length !== c.periods) {
    problems.push(`The number of slots (${c.slots.length}) must equal the number of periods (${c.periods})`);
  }
  if (c.slots.some((s) => !s.hasHolder)) problems.push("Every slot needs a holder");
  if (c.orderMethod !== "draw_monthly" && c.slots.some((s) => s.position === null)) {
    problems.push("Set the turn order first (by hand or by the start draw)");
  }
  return problems;
}

// Task 3: the day the last period is due, as "YYYY-MM-DD".
// Period 1 falls in the month of the start date; the last period is (periods - 1) months later, on the due day.
export function lastDueDate(startDate: string, periods: number, dueDay: number): string {
  const [year, month] = startDate.split("-").map(Number);
  // Date.UTC rolls months past 12 into the next year by itself, so no year arithmetic is needed.
  const last = new Date(Date.UTC(year, month - 1 + (periods - 1), dueDay));
  return last.toISOString().slice(0, 10);
}

// Task 4: what stops this committee from being completed? An empty list means it may be completed.
// today is "YYYY-MM-DD"; unrecordedPayments is how many instalments have no payment recorded.
export function completeProblems(
  c: CommitteeInfo,
  today: string,
  unrecordedPayments: number,
  settlementNote: string | null,
): string[] {
  if (c.status === "forming") return ["A committee cannot be completed before it has started"];
  if (c.status === "completed") return ["This committee is already completed"];

  const problems: string[] = [];
  const last = lastDueDate(c.startDate as string, c.periods, c.dueDay);
  if (today < last) problems.push(`The last period is not over yet (last due day ${last})`);

  const unpaidTurns = c.slots.filter((s) => !s.paidOut).length;
  if (unpaidTurns > 0) problems.push(`${unpaidTurns} turn(s) have not been paid out`);

  const hasNote = (settlementNote ?? "").trim() !== "";
  if (unrecordedPayments > 0 && !hasNote) {
    problems.push(`${unrecordedPayments} payment(s) are not recorded; record them, or say how they were settled`);
  }
  return problems;
}

// Task 5: is this action allowed in this status? A completed committee allows nothing.
const ALLOWED: Record<Action, Status[]> = {
  update_settings: ["forming"],
  add_slot: ["forming"],
  remove_slot: ["forming"],
  remove_member: ["forming"],
  start: ["forming"],
  add_member: ["forming", "running"],
  update_member: ["forming", "running"],
  set_visibility: ["forming", "running"],
  set_order: ["forming", "running"],
  set_order_method: ["forming", "running"],
  record_agreement: ["forming", "running"],
  set_member_link: ["forming", "running"],
  draw_all: ["forming", "running"],
  record_payment: ["running"],
  correct_payment: ["running"],
  attach_receipt: ["running"],
  remove_receipt: ["running"],
  record_payout: ["running"],
  swap_turns: ["running"],
  replace_holder: ["running"],
  draw_next: ["running"],
  complete: ["running"],
};

export function isAllowed(status: Status, action: Action): boolean {
  return ALLOWED[action].includes(status);
}

/** The longest settlement note the organiser may write when finishing a committee. */
export const SETTLEMENT_NOTE_MAX = 500;
