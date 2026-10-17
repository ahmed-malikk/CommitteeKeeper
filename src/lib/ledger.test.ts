import { describe, expect, it } from "vitest";
import { duesFor, lateByDays, potOf, splitPot } from "./ledger";

describe("Task 6 potOf and duesFor", () => {
  it("the pot is the instalment times the number of slots (TC-007)", () => {
    expect(potOf(1000, 12)).toBe(12000);
  });

  it("works for the smallest and largest committee (2 and 30 slots)", () => {
    expect(potOf(500, 2)).toBe(1000);
    expect(potOf(500, 30)).toBe(15000);
  });

  it("a member with two slots owes two instalments each period (TC-007)", () => {
    expect(duesFor(1000, 2)).toBe(2000);
    expect(duesFor(1000, 1)).toBe(1000);
  });
});

describe("Task 7 splitPot", () => {
  it("splits Rs 12,000 as Rs 3,000 and Rs 9,000 when the leaver covered periods 1 to 3 (TC-034)", () => {
    const holders = [
      { memberId: "ali", fromPeriod: 1, toPeriod: 3 },
      { memberId: "sara", fromPeriod: 4, toPeriod: null },
    ];
    expect(splitPot(1000, 12, holders)).toEqual([
      { memberId: "ali", amount: 3000 },
      { memberId: "sara", amount: 9000 },
    ]);
  });

  it("gives everything to one holder when nobody left", () => {
    expect(splitPot(1000, 12, [{ memberId: "ali", fromPeriod: 1, toPeriod: null }])).toEqual([
      { memberId: "ali", amount: 12000 },
    ]);
  });

  it("does not depend on the order the holders are listed in", () => {
    const holders = [
      { memberId: "sara", fromPeriod: 4, toPeriod: null },
      { memberId: "ali", fromPeriod: 1, toPeriod: 3 },
    ];
    expect(splitPot(1000, 12, holders)).toEqual([
      { memberId: "ali", amount: 3000 },
      { memberId: "sara", amount: 9000 },
    ]);
  });

  it("handles a slot that changed hands twice", () => {
    const holders = [
      { memberId: "ali", fromPeriod: 1, toPeriod: 2 },
      { memberId: "sara", fromPeriod: 3, toPeriod: 6 },
      { memberId: "bilal", fromPeriod: 7, toPeriod: null },
    ];
    expect(splitPot(1000, 12, holders)).toEqual([
      { memberId: "ali", amount: 2000 },
      { memberId: "sara", amount: 4000 },
      { memberId: "bilal", amount: 6000 },
    ]);
  });

  it("adds a member's stretches together if the same person held the slot twice", () => {
    const holders = [
      { memberId: "ali", fromPeriod: 1, toPeriod: 2 },
      { memberId: "sara", fromPeriod: 3, toPeriod: 3 },
      { memberId: "ali", fromPeriod: 4, toPeriod: null },
    ];
    expect(splitPot(1000, 4, holders)).toEqual([
      { memberId: "ali", amount: 3000 },
      { memberId: "sara", amount: 1000 },
    ]);
  });

  it("always adds up to the pot", () => {
    const holders = [
      { memberId: "a", fromPeriod: 1, toPeriod: 5 },
      { memberId: "b", fromPeriod: 6, toPeriod: 7 },
      { memberId: "c", fromPeriod: 8, toPeriod: null },
    ];
    const total = splitPot(750, 10, holders).reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBe(potOf(750, 10));
  });

  it("refuses holders that leave a gap, overlap, start late or stop early", () => {
    const message = "Holders must cover every period exactly once";
    expect(() => splitPot(1000, 12, [
      { memberId: "a", fromPeriod: 1, toPeriod: 3 }, { memberId: "b", fromPeriod: 5, toPeriod: null },
    ])).toThrow(message); // gap
    expect(() => splitPot(1000, 12, [
      { memberId: "a", fromPeriod: 1, toPeriod: 5 }, { memberId: "b", fromPeriod: 5, toPeriod: null },
    ])).toThrow(message); // overlap
    expect(() => splitPot(1000, 12, [{ memberId: "a", fromPeriod: 2, toPeriod: null }])).toThrow(message); // starts late
    expect(() => splitPot(1000, 12, [{ memberId: "a", fromPeriod: 1, toPeriod: 10 }])).toThrow(message); // stops early
    expect(() => splitPot(1000, 12, [])).toThrow(message); // nobody
  });
});

describe("Task 9 lateByDays", () => {
  it("is 0 on the due day", () => {
    expect(lateByDays("2026-01-05", "2026-01-05", 0)).toBe(0);
  });

  it("is 0 when paid early", () => {
    expect(lateByDays("2026-01-05", "2026-01-01", 0)).toBe(0);
  });

  it("counts the days after the due day", () => {
    expect(lateByDays("2026-01-05", "2026-01-08", 0)).toBe(3);
  });

  it("does not count the grace days", () => {
    expect(lateByDays("2026-01-05", "2026-01-08", 2)).toBe(1);
    expect(lateByDays("2026-01-05", "2026-01-07", 2)).toBe(0);
    expect(lateByDays("2026-01-05", "2026-01-06", 2)).toBe(0);
  });

  it("counts across a month end (TC-030)", () => {
    expect(lateByDays("2026-01-28", "2026-02-02", 0)).toBe(5);
  });

  it("knows 2028 is a leap year", () => {
    expect(lateByDays("2028-02-28", "2028-03-01", 0)).toBe(2);
    expect(lateByDays("2027-02-28", "2027-03-01", 0)).toBe(1);
  });

  it("counts across a year end", () => {
    expect(lateByDays("2026-12-28", "2027-01-03", 0)).toBe(6);
  });
});
