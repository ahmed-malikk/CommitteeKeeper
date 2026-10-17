export type DisplayStyle = "rs" | "rs_dash";
export type DisplayGrouping = "western" | "lakh";
export type MoneyFormat = { style: DisplayStyle; grouping: DisplayGrouping };

export const DEFAULT_FORMAT: MoneyFormat = { style: "rs", grouping: "western" };

/** Digit groups: western 1,200,000 (threes) or lakh 12,00,000 (last three, then twos). */
function group(digits: string, grouping: DisplayGrouping): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  const size = grouping === "lakh" ? 2 : 3;
  const parts: string[] = [];
  while (rest.length > size) {
    parts.unshift(rest.slice(-size));
    rest = rest.slice(0, -size);
  }
  parts.unshift(rest);
  return [...parts, last3].join(",");
}

/**
 * Shows a whole-rupee amount as the organiser chose: "Rs 12,000" or "Rs. 12,000/-",
 * with western or lakh digit grouping. Only the display changes; the stored value is always whole rupees.
 */
export function formatRupees(amount: number, format: MoneyFormat = DEFAULT_FORMAT): string {
  const whole = Math.trunc(Math.abs(amount));
  const text = group(String(whole), format.grouping);
  const sign = amount < 0 ? "-" : "";
  return format.style === "rs_dash" ? `${sign}Rs. ${text}/-` : `${sign}Rs ${text}`;
}
