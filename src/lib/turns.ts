// Helpers for the Turns page: who holds a slot, which turns may still move, and moving one place up or down.
// Pure functions: no database, no screen.
import { splitPot } from "./ledger";

export type HolderStretch = { memberId: string; name: string; fromPeriod: number; toPeriod: number | null };

export type Turn = {
  id: string;
  position: number | null; // null until the turn has a place
  paidOut: boolean;
  holders: HolderStretch[]; // oldest stretch first
  label: string;
};

/** "Ali" for a slot with one holder; "Ali (periods 1 to 3), Sara (4 to 12)" once a replacement took over ("period 1" for a single period). */
export function holderLabel(holders: HolderStretch[], periods: number): string {
  if (holders.length === 0) return "No holder yet";
  if (holders.length === 1) return holders[0].name;
  return holders
    .map((h, i) => {
      const last = h.toPeriod ?? periods;
      const range = last === h.fromPeriod ? `${h.fromPeriod}` : `${h.fromPeriod} to ${last}`;
      const word = i === 0 ? (last === h.fromPeriod ? "period " : "periods ") : "";
      return `${h.name} (${word}${range})`;
    })
    .join(", ");
}

/** The turns in play order: those with a place by place, then the ones without a place yet, in the order they were made. */
export function inPlayOrder<T extends { position: number | null }>(turns: T[]): T[] {
  const placed = turns.filter((t) => t.position !== null).sort((a, b) => (a.position as number) - (b.position as number));
  const unplaced = turns.filter((t) => t.position === null);
  return [...placed, ...unplaced];
}

/** Moves the item at `index` one place up (-1) or down (+1). A move off either end changes nothing. Returns a new list. */
export function moveBy(ids: string[], index: number, step: -1 | 1): string[] {
  const target = index + step;
  if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// ── Reading the draw history ─────────────────────────────────────────────────

export type DrawEvent = {
  seq: number;
  type: string; // "draw_done" or "draw_redone"
  happenedOn: string;
  payload: { order?: unknown; slot_id?: unknown; position?: unknown; reason?: unknown };
};

export type DrawLine = { seq: number; title: string; detail: string; reason: string | null; date: string };

/** One history entry about a draw, in plain words. `labelOf` turns a slot id into who holds it. */
export function describeDraw(e: DrawEvent, labelOf: (slotId: string) => string): DrawLine {
  const redone = e.type === "draw_redone";
  const reason = typeof e.payload.reason === "string" && e.payload.reason.trim() !== "" ? e.payload.reason : null;
  const order = Array.isArray(e.payload.order) ? (e.payload.order as unknown[]).filter((x): x is string => typeof x === "string") : null;

  if (order) {
    return { seq: e.seq, title: redone ? "Draw redone" : "Draw", detail: order.map(labelOf).join(" → "), reason, date: e.happenedOn };
  }
  const slotId = typeof e.payload.slot_id === "string" ? e.payload.slot_id : "";
  const place = typeof e.payload.position === "number" ? e.payload.position : null;
  const who = slotId ? labelOf(slotId) : "a turn";
  return {
    seq: e.seq,
    title: redone ? "Last draw redone" : "Next turn drawn",
    detail: place === null ? who : `Turn ${place}: ${who}`,
    reason,
    date: e.happenedOn,
  };
}

// ── Swaps ────────────────────────────────────────────────────────────────────

export type SwapEvent = {
  seq: number;
  happenedOn: string;
  payload: { slot_a?: unknown; from_a?: unknown; to_a?: unknown; slot_b?: unknown; from_b?: unknown; to_b?: unknown; reason?: unknown };
};

export type SwapLine = { seq: number; detail: string; reason: string | null; date: string };

/** One swap in plain words: both turns, where each one was and where it is now. */
export function describeSwap(e: SwapEvent, labelOf: (slotId: string) => string): SwapLine {
  const name = (slot: unknown) => (typeof slot === "string" ? labelOf(slot) : "a turn");
  const place = (n: unknown) => (typeof n === "number" ? String(n) : "?");
  const reason = typeof e.payload.reason === "string" && e.payload.reason.trim() !== "" ? e.payload.reason : null;
  return {
    seq: e.seq,
    detail: `${name(e.payload.slot_a)}: turn ${place(e.payload.from_a)} to ${place(e.payload.to_a)}. ${name(e.payload.slot_b)}: turn ${place(e.payload.from_b)} to ${place(e.payload.to_b)}.`,
    reason,
    date: e.happenedOn,
  };
}

// ── Leavers and the split pot ────────────────────────────────────────────────

export type PotShare = { name: string; amount: number };

/** Who gets what when this slot's pot is paid out. Null when one person held the slot all along (nothing to split). */
export function potSplit(holders: HolderStretch[], amount: number, periods: number): PotShare[] | null {
  if (holders.length < 2) return null;
  try {
    const shares = splitPot(amount, periods, holders.map((h) => ({ memberId: h.memberId, fromPeriod: h.fromPeriod, toPeriod: h.toPeriod })));
    const names = new Map(holders.map((h) => [h.memberId, h.name]));
    return shares.map((s) => ({ name: names.get(s.memberId) ?? "Unknown", amount: s.amount }));
  } catch {
    return null; // the stretches do not add up; show nothing rather than a wrong figure
  }
}

/** The split there would be if `replacement` took the slot over from `fromPeriod`. The current holder's stretch ends the period before. */
export function previewReplacement(
  holders: HolderStretch[],
  replacement: { memberId: string; name: string },
  fromPeriod: number,
  amount: number,
  periods: number,
): PotShare[] | null {
  if (holders.length === 0) return null;
  const ended = holders.map((h, i) => (i === holders.length - 1 ? { ...h, toPeriod: fromPeriod - 1 } : h));
  return potSplit([...ended, { ...replacement, fromPeriod, toPeriod: null }], amount, periods);
}
