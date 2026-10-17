import { describe, expect, it } from "vitest";
import { firstOfNextMonth, formatDate, ordinal, todayInPakistan } from "./dates";

describe("dates", () => {
  it("formats a date as day, month name, year", () => {
    expect(formatDate("2026-11-01")).toBe("1 Nov 2026");
    expect(formatDate("2027-02-28")).toBe("28 Feb 2027");
  });

  it("adds the right ordinal ending", () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 21, 22, 28].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "10th", "11th", "12th", "13th", "21st", "22nd", "28th"]);
  });

  it("finds the first of next month, across the year end", () => {
    expect(firstOfNextMonth("2026-10-17")).toBe("2026-11-01");
    expect(firstOfNextMonth("2026-12-31")).toBe("2027-01-01");
  });

  it("uses Pakistan time, which is already tomorrow late in the evening UTC", () => {
    expect(todayInPakistan(new Date("2026-10-17T20:30:00Z"))).toBe("2026-10-18");
    expect(todayInPakistan(new Date("2026-10-17T10:00:00Z"))).toBe("2026-10-17");
  });
});
