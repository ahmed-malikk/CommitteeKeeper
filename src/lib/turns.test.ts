import { describe, expect, it } from "vitest";
import { holderLabel, inPlayOrder, moveBy, sameList } from "./turns";

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
