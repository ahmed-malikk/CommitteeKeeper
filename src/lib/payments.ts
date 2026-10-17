// Who owes what, and how late (rules sections 4 and 5). Pure functions: no database, no screen.
// The home screen, the payments list and the grid all count through `summarise`, so their numbers cannot disagree.
import { lateByDays } from "./ledger";

export const METHODS = ["cash", "bank", "easypaisa", "jazzcash", "other"] as const;
export type Method = (typeof METHODS)[number];

export const METHOD_LABELS: Record<Method, string> = {
  cash: "Cash",
  bank: "Bank deposit",
  easypaisa: "Easypaisa",
  jazzcash: "JazzCash",
  other: "Other",
};

/** The day a period's instalment is due: period 1 falls in the start date's month, then one month later each time. */
export function dueDateFor(startDate: string, dueDay: number, period: number): string {
  const [year, month] = startDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + (period - 1), dueDay)).toISOString().slice(0, 10);
}

/** Which period falls in today's month (1-based). 0 before the first month; more than `periods` after the last one. */
export function currentPeriod(startDate: string, today: string): number {
  const [sy, sm] = startDate.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  return (ty - sy) * 12 + (tm - sm) + 1;
}

export type CommitteeTerms = { startDate: string; dueDay: number; graceDays: number; periods: number };
export type PaidRecord = { slotId: string; period: number; paidOn: string };

export type Cell = {
  slotId: string;
  period: number;
  due: string;
  /** paid: recorded. late: unrecorded and past the grace days. due: unrecorded and still on time. upcoming: a later month. */
  state: "paid" | "late" | "due" | "upcoming";
  paidOn: string | null;
  /** Days late: for an unrecorded one counted to today, for a paid one counted to the day it was paid. 0 when on time. */
  daysLate: number;
};

/** The state of one slot in one period. `paid` is the payment that counts for it, or undefined. */
export function cellOf(terms: CommitteeTerms, today: string, slotId: string, period: number, paid: PaidRecord | undefined): Cell {
  const due = dueDateFor(terms.startDate, terms.dueDay, period);
  if (paid) {
    return { slotId, period, due, state: "paid", paidOn: paid.paidOn, daysLate: lateByDays(due, paid.paidOn, terms.graceDays) };
  }
  if (currentPeriod(terms.startDate, today) < period) {
    return { slotId, period, due, state: "upcoming", paidOn: null, daysLate: 0 };
  }
  const late = lateByDays(due, today, terms.graceDays);
  return { slotId, period, due, state: late > 0 ? "late" : "due", paidOn: null, daysLate: late };
}

export type Summary = {
  /** The period that falls in today's month, or null when none does (not started yet, or already over). */
  period: number | null;
  paidThisPeriod: number;
  unpaidThisPeriod: number;
  slotCount: number;
  /** Every unrecorded instalment past its grace days, in any period, longest late first. */
  late: Cell[];
};

export function summarise(terms: CommitteeTerms, today: string, slotIds: string[], paid: PaidRecord[]): Summary {
  const byKey = new Map(paid.map((p) => [`${p.slotId}|${p.period}`, p]));
  const now = currentPeriod(terms.startDate, today);
  const period = now >= 1 && now <= terms.periods ? now : null;

  const late: Cell[] = [];
  let paidThisPeriod = 0;
  const lastToCheck = Math.min(now, terms.periods);
  for (let p = 1; p <= lastToCheck; p++) {
    for (const slotId of slotIds) {
      const cell = cellOf(terms, today, slotId, p, byKey.get(`${slotId}|${p}`));
      if (cell.state === "late") late.push(cell);
      if (p === period && cell.state === "paid") paidThisPeriod++;
    }
  }
  late.sort((a, b) => b.daysLate - a.daysLate || a.period - b.period);
  return { period, paidThisPeriod, unpaidThisPeriod: period === null ? 0 : slotIds.length - paidThisPeriod, slotCount: slotIds.length, late };
}

/** "late by 1 day" / "late by 5 days". */
export function lateText(days: number): string {
  return `late by ${days} day${days === 1 ? "" : "s"}`;
}

