import { describe, expect, it } from "vitest";
import { historyWords, looksLikeToken, parseMemberView, progressText, turnText } from "./member-view";

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

describe("progressText", () => {
  it("says where a running committee is, and how many months are left", () => {
    expect(progressText({ committee, current_period: 3, periods_left: 9 })).toBe("Month 3 of 12. 9 months left after this one.");
    expect(progressText({ committee, current_period: 11, periods_left: 1 })).toBe("Month 11 of 12. 1 month left after this one.");
    expect(progressText({ committee, current_period: 12, periods_left: 0 })).toBe("This is the last month (12 of 12).");
  });
  it("says so before the start and after the end", () => {
    expect(progressText({ committee: { ...committee, status: "forming" }, current_period: 0, periods_left: 12 })).toMatch(/Not started yet.*12 months from Jan 2026/);
    expect(progressText({ committee: { ...committee, status: "completed" }, current_period: 12, periods_left: 0 })).toBe("This committee is completed.");
  });
});

describe("turnText", () => {
  it("names the month the pot comes, and whether it was paid out", () => {
    expect(turnText({ slot_id: "s", position: 4, paid_out: false, stretches: [{ from: 1, to: null }] }, "2026-01-01")).toBe("Turn 4: the pot comes to you in Apr 2026.");
    expect(turnText({ slot_id: "s", position: 1, paid_out: true, stretches: [{ from: 1, to: null }] }, "2026-01-01")).toContain("(paid out)");
  });
  it("says so when the place is not set, and when someone else took over part of the turn", () => {
    expect(turnText({ slot_id: "s", position: null, paid_out: false, stretches: null }, "2026-01-01")).toBe("Your place in the order is not set yet.");
    expect(turnText({ slot_id: "s", position: 6, paid_out: false, stretches: [{ from: 1, to: 3 }] }, "2026-01-01")).toContain("months 1 to 3 of it; someone else took over");
  });
});

describe("historyWords", () => {
  it("has plain words for known entries and a safe fallback", () => {
    expect(historyWords("payout_recorded")).toBe("A pot was handed to you");
    expect(historyWords("something_new")).toBe("Something changed that involves you");
  });
});
