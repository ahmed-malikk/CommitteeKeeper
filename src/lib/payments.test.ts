import { describe, expect, it } from "vitest";
import { cellOf, currentPeriod, dueDateFor, lateText, paymentProblems, periodLabel, summarise, type CommitteeTerms } from "./payments";

const terms: CommitteeTerms = { startDate: "2026-10-01", dueDay: 10, graceDays: 2, periods: 3 };

describe("dueDateFor and currentPeriod", () => {
  it("period 1 is in the start month, then one month later each time", () => {
    expect(dueDateFor("2026-10-01", 10, 1)).toBe("2026-10-10");
    expect(dueDateFor("2026-10-01", 10, 4)).toBe("2027-01-10");
  });

  it("finds the period that falls in today's month, across a year end", () => {
    expect(currentPeriod("2026-10-01", "2026-09-30")).toBe(0);
    expect(currentPeriod("2026-10-01", "2026-10-31")).toBe(1);
    expect(currentPeriod("2026-10-01", "2027-01-02")).toBe(4);
  });
});

describe("cellOf", () => {
  it("is paid when a payment counts, and shows how late it was paid (grace respected)", () => {
    const c = cellOf(terms, "2026-10-20", "s1", 1, { slotId: "s1", period: 1, paidOn: "2026-10-15" });
    expect(c).toMatchObject({ state: "paid", daysLate: 3, paidOn: "2026-10-15" });
    expect(cellOf(terms, "2026-10-20", "s1", 1, { slotId: "s1", period: 1, paidOn: "2026-10-12" }).daysLate).toBe(0);
  });

  it("is due (not late) during the grace days", () => {
    expect(cellOf(terms, "2026-10-12", "s1", 1, undefined)).toMatchObject({ state: "due", daysLate: 0 });
  });

  it("is late once the grace days are over, counted in days", () => {
    expect(cellOf(terms, "2026-10-13", "s1", 1, undefined)).toMatchObject({ state: "late", daysLate: 1 });
    expect(cellOf(terms, "2026-10-17", "s1", 1, undefined)).toMatchObject({ state: "late", daysLate: 5 });
  });

  it("a later month is upcoming, even on the due day of this one", () => {
    expect(cellOf(terms, "2026-10-31", "s1", 2, undefined).state).toBe("upcoming");
  });
});

describe("summarise", () => {
  const slots = ["a", "b", "c"];

  it("counts this month's payments and lists the late ones, longest first (TC-029, TC-030)", () => {
    const s = summarise(terms, "2026-11-20", slots, [
      { slotId: "a", period: 1, paidOn: "2026-10-09" },
      { slotId: "a", period: 2, paidOn: "2026-11-10" },
      { slotId: "b", period: 1, paidOn: "2026-10-30" },
    ]);
    expect(s.period).toBe(2);
    expect(s.paidThisPeriod).toBe(1);
    expect(s.unpaidThisPeriod).toBe(2);
    // c owes period 1 (due 10 Oct) and period 2; b owes period 2 (due 10 Nov, 10 days after minus 2 grace = 8).
    expect(s.late.map((c) => [c.slotId, c.period, c.daysLate])).toEqual([
      ["c", 1, 39],
      ["b", 2, 8],
      ["c", 2, 8],
    ]);
  });

  it("has no current period before the start month or after the last one", () => {
    expect(summarise(terms, "2026-09-15", slots, []).period).toBeNull();
    expect(summarise(terms, "2026-09-15", slots, []).late).toEqual([]);
    const over = summarise(terms, "2027-02-01", slots, []);
    expect(over.period).toBeNull();
    expect(over.late).toHaveLength(9); // 3 slots x 3 periods, none recorded
  });
});

describe("lateText", () => {
  it("uses the singular for one day", () => {
    expect(lateText(1)).toBe("late by 1 day");
    expect(lateText(5)).toBe("late by 5 days");
  });
});

describe("paymentProblems", () => {
  const ok = { slotId: "s1", period: 2, paidOn: "2026-10-10", method: "cash", note: "" };

  it("accepts a complete, valid entry (the amount is not an input at all)", () => {
    expect(paymentProblems(ok, 12, "2026-10-17")).toEqual({});
    expect(paymentProblems({ ...ok, paidOn: "2026-10-17" }, 12, "2026-10-17")).toEqual({}); // today is fine
  });

  it("refuses a date in the future, with the reason (FR-7)", () => {
    expect(paymentProblems({ ...ok, paidOn: "2026-10-18" }, 12, "2026-10-17").paidOn).toMatch(/future/);
  });

  it("refuses a missing or impossible date", () => {
    expect(paymentProblems({ ...ok, paidOn: "" }, 12, "2026-10-17").paidOn).toBeDefined();
    expect(paymentProblems({ ...ok, paidOn: "2026-02-30" }, 12, "2026-10-17").paidOn).toBeDefined();
  });

  it("refuses an unknown method, a missing slot and a period outside the committee", () => {
    const p = paymentProblems({ slotId: "", period: 13, paidOn: "2026-10-10", method: "cheque", note: "" }, 12, "2026-10-17");
    expect(Object.keys(p).sort()).toEqual(["method", "period", "slot"]);
    expect(paymentProblems({ ...ok, period: 0 }, 12, "2026-10-17").period).toBeDefined();
    expect(paymentProblems({ ...ok, period: 1.5 }, 12, "2026-10-17").period).toBeDefined();
  });

  it("limits the private note to 200 characters", () => {
    expect(paymentProblems({ ...ok, note: "x".repeat(200) }, 12, "2026-10-17").note).toBeUndefined();
    expect(paymentProblems({ ...ok, note: "x".repeat(201) }, 12, "2026-10-17").note).toBeDefined();
  });
});

describe("periodLabel", () => {
  it("names the month a period falls in, across a year end", () => {
    expect(periodLabel("2026-10-01", 1)).toBe("Oct 2026");
    expect(periodLabel("2026-10-01", 4)).toBe("Jan 2027");
  });
});
