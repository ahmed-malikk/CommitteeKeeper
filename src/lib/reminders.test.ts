import { describe, expect, it } from "vitest";
import { dueList, reminderMessage, summaryText, whatsappLink, whatsappNumber } from "./reminders";

// Starts 1 Jan 2026, due on the 10th, 2 grace days, 3 periods: due 10 Jan, 10 Feb, 10 Mar.
const terms = { startDate: "2026-01-01", dueDay: 10, graceDays: 2, periods: 3 };
const settings = { remindBeforeDays: 2, remindLateEvery: 3 };

describe("dueList", () => {
  it("is empty well before the first due day", () => {
    expect(dueList(terms, settings, "2026-01-02", ["a"], [])).toEqual([]);
  });
  it("lists an instalment as due soon inside the window, and reminds exactly N days before", () => {
    const eight = dueList(terms, settings, "2026-01-08", ["a"], []);
    expect(eight).toMatchObject([{ kind: "before", period: 1, daysUntil: 2, remindToday: true }]);
    const nine = dueList(terms, settings, "2026-01-09", ["a"], []);
    expect(nine).toMatchObject([{ kind: "before", daysUntil: 1, remindToday: false }]);
  });
  it("reminds on the due day, and keeps it as due (no reminder) through the grace days", () => {
    expect(dueList(terms, settings, "2026-01-10", ["a"], [])[0]).toMatchObject({ kind: "due", remindToday: true });
    expect(dueList(terms, settings, "2026-01-12", ["a"], [])[0]).toMatchObject({ kind: "due", daysLate: 0, remindToday: false });
  });
  it("is late from the first day after the grace days, reminding then and every N days", () => {
    const at = (day: string) => dueList(terms, settings, day, ["a"], [])[0];
    expect(at("2026-01-13")).toMatchObject({ kind: "late", daysLate: 1, remindToday: true });
    expect(at("2026-01-14")).toMatchObject({ daysLate: 2, remindToday: false });
    expect(at("2026-01-15")).toMatchObject({ daysLate: 3, remindToday: false });
    expect(at("2026-01-16")).toMatchObject({ daysLate: 4, remindToday: true });
  });
  it("leaves out what is paid, and puts late before due before soon, the longest late first", () => {
    const list = dueList(terms, settings, "2026-02-09", ["a", "b"], [{ slotId: "a", period: 1, paidOn: "2026-01-10" }]);
    expect(list.map((i) => `${i.slotId}${i.period}${i.kind}`)).toEqual(["b1late", "a2before", "b2before"]);
    expect(list[0].daysLate).toBe(28);
  });
  it("shows no advance reminders when the window is 0", () => {
    expect(dueList(terms, { remindBeforeDays: 0, remindLateEvery: 3 }, "2026-01-09", ["a"], [])).toEqual([]);
  });
});

describe("whatsappNumber and whatsappLink", () => {
  it("turns the usual ways of writing a Pakistani number into one form", () => {
    for (const p of ["0300 1234567", "+92 300 1234567", "0092-300-1234567", "300-1234567", "923001234567"]) expect(whatsappNumber(p)).toBe("923001234567");
  });
  it("gives null for nothing or something that is not a phone number", () => {
    expect(whatsappNumber("")).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber("12")).toBeNull();
  });
  it("builds an ordinary wa.me link with the text encoded, Urdu names included", () => {
    const link = whatsappLink("0300 1234567", "Hello مریم & Ali");
    expect(link).toBe(`https://wa.me/923001234567?text=${encodeURIComponent("Hello مریم & Ali")}`);
    expect(decodeURIComponent(link!.split("text=")[1])).toBe("Hello مریم & Ali");
    expect(whatsappLink(null, "x")).toBeNull();
  });
});

describe("reminderMessage and summaryText", () => {
  const base = { name: "Ali", committee: "Mohalla", amountText: "Rs 1,000", start: "2026-01-01", period: 2, due: "2026-02-10", dueText: "10 Feb 2026", daysLate: 0 };
  it("words the three kinds differently, and counts the days late", () => {
    expect(reminderMessage({ ...base, kind: "before" })).toContain("is due on 10 Feb 2026");
    expect(reminderMessage({ ...base, kind: "due" })).toContain("Feb 2026");
    expect(reminderMessage({ ...base, kind: "late", daysLate: 1 })).toContain("is 1 day late");
    expect(reminderMessage({ ...base, kind: "late", daysLate: 5 })).toContain("is 5 days late");
  });
  it("never includes anyone else's name", () => {
    expect(reminderMessage({ ...base, kind: "late", daysLate: 3 })).not.toMatch(/Sara/);
  });
  it("lists the lines of the daily email, or says nothing is due", () => {
    expect(summaryText("Mohalla", "2026-02-12", [])).toBe("Mohalla: nothing is due or late today.");
    const text = summaryText("Mohalla", "2026-02-12", [{ who: "Ali", month: "Feb 2026", kind: "late", daysLate: 2 }]);
    expect(text).toContain("- Ali, Feb 2026: late by 2 days");
  });
});
