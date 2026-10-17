import { describe, expect, it } from "vitest";
import { formatRupees } from "./money";

describe("formatRupees", () => {
  it("shows the plain style with western grouping by default", () => {
    expect(formatRupees(12000)).toBe("Rs 12,000");
    expect(formatRupees(1200000)).toBe("Rs 1,200,000");
  });

  it("shows the Rs. 12,000/- style", () => {
    expect(formatRupees(12000, { style: "rs_dash", grouping: "western" })).toBe("Rs. 12,000/-");
  });

  it("groups in lakhs when asked", () => {
    expect(formatRupees(1200000, { style: "rs", grouping: "lakh" })).toBe("Rs 12,00,000");
    expect(formatRupees(123456789, { style: "rs", grouping: "lakh" })).toBe("Rs 12,34,56,789");
    expect(formatRupees(100000, { style: "rs_dash", grouping: "lakh" })).toBe("Rs. 1,00,000/-");
  });

  it("leaves small amounts ungrouped", () => {
    expect(formatRupees(5)).toBe("Rs 5");
    expect(formatRupees(999)).toBe("Rs 999");
    expect(formatRupees(1000)).toBe("Rs 1,000");
  });
});
