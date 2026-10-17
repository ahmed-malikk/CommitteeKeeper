import { describe, expect, it } from "vitest";
import { describeDraw, holderLabel, inPlayOrder, moveBy, sameList } from "./turns";

describe("holderLabel", () => {
  it("is just the name for a slot with one holder", () => {
    expect(holderLabel([{ name: "Ali", fromPeriod: 1, toPeriod: null }], 12)).toBe("Ali");
  });

  it("shows the periods each person covers after a replacement", () => {
    const holders = [
      { name: "Ali", fromPeriod: 1, toPeriod: 3 },
      { name: "Sara", fromPeriod: 4, toPeriod: null },
    ];
    expect(holderLabel(holders, 12)).toBe("Ali (periods 1 to 3), Sara (4 to 12)");
  });

  it("says so when nobody holds the slot", () => {
    expect(holderLabel([], 12)).toBe("No holder yet");
  });
});

describe("inPlayOrder", () => {
  it("sorts by place and puts turns without a place last", () => {
    const sorted = inPlayOrder([{ id: "c", position: null }, { id: "b", position: 2 }, { id: "a", position: 1 }]);
    expect(sorted.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});

describe("moveBy", () => {
  it("moves an item down and up by one place", () => {
    expect(moveBy(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveBy(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
  });

  it("changes nothing at either end, and never changes the list it was given", () => {
    const list = ["a", "b", "c"];
    expect(moveBy(list, 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveBy(list, 2, 1)).toEqual(["a", "b", "c"]);
    moveBy(list, 0, 1);
    expect(list).toEqual(["a", "b", "c"]);
  });
});

describe("sameList", () => {
  it("compares order, not just contents", () => {
    expect(sameList(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameList(["a", "b"], ["b", "a"])).toBe(false);
    expect(sameList(["a"], ["a", "b"])).toBe(false);
  });
});

describe("describeDraw", () => {
  const labelOf = (id: string) => ({ a: "Ali", b: "Sara", c: "Hira" })[id as "a" | "b" | "c"] ?? "?";

  it("lists a start draw in the order drawn", () => {
    const line = describeDraw({ seq: 4, type: "draw_done", happenedOn: "2026-03-01", payload: { order: ["b", "c", "a"], reason: null } }, labelOf);
    expect(line).toEqual({ seq: 4, title: "Draw", detail: "Sara → Hira → Ali", reason: null, date: "2026-03-01" });
  });

  it("calls a second start draw a redo and keeps the reason", () => {
    const line = describeDraw({ seq: 5, type: "draw_redone", happenedOn: "2026-03-02", payload: { order: ["a", "b"], reason: "Hira was absent" } }, labelOf);
    expect(line.title).toBe("Draw redone");
    expect(line.reason).toBe("Hira was absent");
  });

  it("describes a month-by-month draw with its place", () => {
    const line = describeDraw({ seq: 6, type: "draw_done", happenedOn: "2026-03-05", payload: { slot_id: "c", position: 2 } }, labelOf);
    expect(line).toMatchObject({ title: "Next turn drawn", detail: "Turn 2: Hira" });
  });

  it("describes a redone month-by-month draw", () => {
    const line = describeDraw({ seq: 7, type: "draw_redone", happenedOn: "2026-03-05", payload: { slot_id: "a", position: 2, reason: "  " } }, labelOf);
    expect(line).toMatchObject({ title: "Last draw redone", detail: "Turn 2: Ali", reason: null });
  });
});
