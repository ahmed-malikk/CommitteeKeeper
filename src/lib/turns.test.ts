import { describe, expect, it } from "vitest";
import { describeDraw, describeSwap, holderAt, holderLabel, inPlayOrder, moveBy, potSplit, previewReplacement, sameList } from "./turns";

describe("holderLabel", () => {
  it("is just the name for a slot with one holder", () => {
    expect(holderLabel([{ memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: null }], 12)).toBe("Ali");
  });

  it("shows the periods each person covers after a replacement", () => {
    const holders = [
      { memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: 3 },
      { memberId: "sara", name: "Sara", fromPeriod: 4, toPeriod: null },
    ];
    expect(holderLabel(holders, 12)).toBe("Ali (periods 1 to 3), Sara (4 to 12)");
  });

  it("says period, not periods, for a stretch of one period", () => {
    const holders = [
      { memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: 1 },
      { memberId: "sara", name: "Sara", fromPeriod: 2, toPeriod: null },
    ];
    expect(holderLabel(holders, 4)).toBe("Ali (period 1), Sara (2 to 4)");
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

describe("describeSwap", () => {
  const labelOf = (id: string) => ({ a: "Ali", b: "Sara" })[id as "a" | "b"] ?? "?";

  it("names both turns with their old and new places", () => {
    const line = describeSwap(
      { seq: 9, happenedOn: "2026-04-02", payload: { slot_a: "a", from_a: 1, to_a: 3, slot_b: "b", from_b: 3, to_b: 1, reason: "Sara needs the money first" } },
      labelOf,
    );
    expect(line.detail).toBe("Ali: turn 1 to 3. Sara: turn 3 to 1.");
    expect(line.reason).toBe("Sara needs the money first");
    expect(line.date).toBe("2026-04-02");
  });

  it("survives a payload with missing parts", () => {
    const line = describeSwap({ seq: 1, happenedOn: "2026-04-02", payload: {} }, labelOf);
    expect(line.detail).toBe("a turn: turn ? to ?. a turn: turn ? to ?.");
    expect(line.reason).toBeNull();
  });
});

describe("potSplit", () => {
  const ali = { memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: 3 };
  const sara = { memberId: "sara", name: "Sara", fromPeriod: 4, toPeriod: null };

  it("splits Rs 12,000 as Rs 3,000 and Rs 9,000 (TC-034)", () => {
    expect(potSplit([ali, sara], 1000, 12)).toEqual([
      { name: "Ali", amount: 3000 },
      { name: "Sara", amount: 9000 },
    ]);
  });

  it("has nothing to split when one person held the slot all along", () => {
    expect(potSplit([{ memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: null }], 1000, 12)).toBeNull();
  });

  it("shows nothing rather than a wrong figure when the stretches do not add up", () => {
    expect(potSplit([ali, { ...sara, fromPeriod: 6 }], 1000, 12)).toBeNull();
  });
});

describe("previewReplacement", () => {
  it("ends the current holder the period before and gives the rest to the replacement", () => {
    const holders = [{ memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: null }];
    expect(previewReplacement(holders, { memberId: "sara", name: "Sara" }, 4, 1000, 12)).toEqual([
      { name: "Ali", amount: 3000 },
      { name: "Sara", amount: 9000 },
    ]);
  });

  it("works when the slot has already changed hands once", () => {
    const holders = [
      { memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: 2 },
      { memberId: "sara", name: "Sara", fromPeriod: 3, toPeriod: null },
    ];
    expect(previewReplacement(holders, { memberId: "bilal", name: "Bilal" }, 7, 1000, 12)).toEqual([
      { name: "Ali", amount: 2000 },
      { name: "Sara", amount: 4000 },
      { name: "Bilal", amount: 6000 },
    ]);
  });
});

describe("holderAt", () => {
  const holders = [
    { memberId: "ali", name: "Ali", fromPeriod: 1, toPeriod: 3 },
    { memberId: "sara", name: "Sara", fromPeriod: 4, toPeriod: null },
  ];
  it("finds the holder whose stretch covers the period, at both ends of a stretch", () => {
    expect(holderAt(holders, 1)?.name).toBe("Ali");
    expect(holderAt(holders, 3)?.name).toBe("Ali");
    expect(holderAt(holders, 4)?.name).toBe("Sara");
    expect(holderAt(holders, 12)?.name).toBe("Sara");
  });
  it("is undefined when nobody holds the slot yet", () => {
    expect(holderAt([], 1)).toBeUndefined();
    expect(holderAt([{ memberId: "x", name: "X", fromPeriod: 5, toPeriod: null }], 2)).toBeUndefined();
  });
});

