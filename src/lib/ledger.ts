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
