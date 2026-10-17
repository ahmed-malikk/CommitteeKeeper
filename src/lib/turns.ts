// Helpers for the Turns page: who holds a slot, which turns may still move, and moving one place up or down.
// Pure functions: no database, no screen.

export type HolderStretch = { name: string; fromPeriod: number; toPeriod: number | null };

export type Turn = {
  id: string;
  position: number | null; // null until the turn has a place
  paidOut: boolean;
  holders: HolderStretch[]; // oldest stretch first
  label: string;
};

/** "Ali" for a slot with one holder; "Ali (periods 1 to 3), Sara (4 to 12)" once a replacement took over. */
export function holderLabel(holders: HolderStretch[], periods: number): string {
  if (holders.length === 0) return "No holder yet";
  if (holders.length === 1) return holders[0].name;
  return holders
    .map((h, i) => {
      const range = `${h.fromPeriod} to ${h.toPeriod ?? periods}`;
      return `${h.name} (${i === 0 ? "periods " : ""}${range})`;
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
