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
