import { describe, expect, it } from "vitest";
import { looksLikeToken, parseMemberView } from "./member-view";

const committee = { name: "Mohalla", status: "running" as const, amount: 1000, periods: 12, start_date: "2026-01-01", due_day: 10, grace_days: 2, display_style: "rs" as const, display_grouping: "western" as const };

describe("parseMemberView and looksLikeToken", () => {
  it("treats the empty answer for a link that does not work as nothing", () => {
    expect(parseMemberView({})).toBeNull();
    expect(parseMemberView(null)).toBeNull();
    expect(parseMemberView("x")).toBeNull();
  });
  it("accepts a full answer", () => {
    expect(parseMemberView({ committee, me: { member_id: "m", name: "Ali" }, current_period: 3, periods_left: 9, my_slots: [], my_payments: [] })).not.toBeNull();
  });
  it("only lets plausible tokens reach the database", () => {
    expect(looksLikeToken("A".repeat(43))).toBe(true);
    expect(looksLikeToken("not-a-link")).toBe(false);
    expect(looksLikeToken("a/b".padEnd(43, "c"))).toBe(false);
    expect(looksLikeToken("")).toBe(false);
  });
});
