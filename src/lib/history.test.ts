import { describe, expect, it } from "vitest";
import { chainStatus, describeEvent, formatRecorded, shortHash, type HistoryEvent, type Lookups } from "./history";

const look: Lookups = {
  member: (id) => ({ m1: "Ali", m2: "Sara" })[id] ?? "Unknown",
  slot: (id) => ({ s1: "Ali", s2: "Sara" })[id] ?? "a turn",
  money: (n) => `Rs ${n.toLocaleString("en-US")}`,
  period: (n) => `P${n}`,
};
const event = (type: string, payload: Record<string, unknown> = {}): HistoryEvent => ({
  seq: 5, type, happenedOn: "2026-01-12", recordedAt: "2026-10-18T18:28:00Z", actorId: "u1", payload, correctsSeq: null, hash: "abc",
});

describe("describeEvent", () => {
  it("says who paid, for which month, how much and how", () => {
    const l = describeEvent(event("payment_recorded", { member_id: "m1", period: 1, amount: 1000, method: "easypaisa" }), look);
    expect(l.title).toBe("Payment recorded");
    expect(l.detail).toBe("Ali for P1: Rs 1,000 by Easypaisa.");
  });
  it("tells a correction from a cancellation, and carries the reason", () => {
    const fixed = describeEvent(event("payment_corrected", { member_id: "m1", period: 1, method: "bank", cancelled: false, reason: "Wrong day" }), look);
    expect(fixed.title).toBe("Payment corrected");
    expect(fixed.reason).toBe("Wrong day");
    const gone = describeEvent(event("payment_corrected", { member_id: "m1", period: 1, cancelled: true, reason: "Wrong member" }), look);
    expect(gone.title).toBe("Payment cancelled");
    expect(gone.detail).toMatch(/unpaid again/);
  });
  it("shows a split pot with each receiver", () => {
    const l = describeEvent(event("payout_recorded", { period: 2, amount: 2000, split: [{ member_id: "m1", amount: 500 }, { member_id: "m2", amount: 1500 }] }), look);
    expect(l.detail).toBe("Turn 2: Rs 2,000 to Ali Rs 500 · Sara Rs 1,500.");
  });
  it("shows a short fingerprint for receipts", () => {
    const l = describeEvent(event("receipt_attached", { slot_no: 1, sha256: "0123456789abcdef0123" }), look);
    expect(l.detail).toContain("0123456789ab…");
  });
  it("tells the two kinds of settings entry apart", () => {
    expect(describeEvent(event("settings_set", { order_method: "draw_monthly", reason: "Members asked" }), look)).toMatchObject({ title: "Way of deciding turns changed", reason: "Members asked" });
    expect(describeEvent(event("settings_set", { members_see_payments: true }), look).title).toBe("What members can see was changed");
  });
  it("never throws on an entry type it does not know", () => {
    expect(describeEvent(event("something_new"), look).title).toBe("something new");
  });
});

describe("chainStatus", () => {
  it("reads ok as intact and a break as where it broke", () => {
    expect(chainStatus("ok")).toMatchObject({ ok: true });
    expect(chainStatus("broken at entry 7: its contents were changed")).toEqual({ ok: false, text: "Broken at entry 7: its contents were changed." });
    expect(chainStatus("broken at entry 3: an entry is missing").text).toMatch(/missing/);
  });
  it("says so when the check could not run", () => {
    expect(chainStatus(null).ok).toBe(false);
  });
});

describe("formatRecorded and shortHash", () => {
  it("shows the time in Pakistan (UTC+5), across midnight too", () => {
    expect(formatRecorded("2026-10-18T18:28:00Z")).toBe("18 Oct 2026, 11:28 pm");
    expect(formatRecorded("2026-10-18T19:05:00Z")).toBe("19 Oct 2026, 12:05 am");
    expect(formatRecorded("2026-10-18T07:00:00Z")).toBe("18 Oct 2026, 12:00 pm");
  });
  it("keeps a short fingerprint as it is and cuts a long one", () => {
    expect(shortHash("abc")).toBe("abc");
    expect(shortHash("0123456789abcdef")).toBe("0123456789ab…");
  });
});
