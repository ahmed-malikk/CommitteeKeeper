import { describe, expect, it } from "vitest";
import { duesFor, potOf } from "./ledger";

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
