// Money, dates, turns and the history fingerprint (rules sections 2, 4, 5, 7 and 13).
// Pure functions: no database, no screen. The SQL functions check and store; the real arithmetic lives here.

// ── Money ────────────────────────────────────────────────────────────────────

// Task 6: the pot, and what a member owes each period. Whole rupees, no decimals.
export function potOf(amount: number, slotCount: number): number {
  return amount * slotCount;
}

export function duesFor(amount: number, slotsHeld: number): number {
  return amount * slotsHeld;
}

export type Holder = { memberId: string; fromPeriod: number; toPeriod: number | null }; // null = until the end
export type Share = { memberId: string; amount: number };

// Task 7: who receives what when a slot's pot is paid out (rules L2, L3).
// Each holder gets the instalment for every period they were responsible for over the whole cycle.
// The holders must cover every period exactly once; if not, throw.
export function splitPot(amount: number, periods: number, holders: Holder[]): Share[] {
  const sorted = [...holders].sort((a, b) => a.fromPeriod - b.fromPeriod);

  // Walk the stretches in order: each must start exactly where the one before ended, from period 1 to the last period.
  let next = 1;
  for (const h of sorted) {
    if (h.fromPeriod !== next) throw new Error("Holders must cover every period exactly once");
    const last = h.toPeriod ?? periods;
    if (last < h.fromPeriod || last > periods) throw new Error("Holders must cover every period exactly once");
    next = last + 1;
  }
  if (next !== periods + 1) throw new Error("Holders must cover every period exactly once");

  // A Map keeps one total per member, in the order they first appear, so a member who held two stretches is added together.
  const totals = new Map<string, number>();
  for (const h of sorted) {
    const count = (h.toPeriod ?? periods) - h.fromPeriod + 1;
    totals.set(h.memberId, (totals.get(h.memberId) ?? 0) + amount * count);
  }
  return [...totals].map(([memberId, total]) => ({ memberId, amount: total }));
}
