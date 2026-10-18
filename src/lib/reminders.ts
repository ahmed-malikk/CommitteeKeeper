// Who to remind today, and the message to send (rules section 10). Pure functions: no database, no screen.
// The Reminders screen and the daily job both count through `dueList`, so they cannot disagree.
import { dueDateFor, periodLabel, type CommitteeTerms, type PaidRecord } from "./payments";
import { lateByDays } from "./ledger";

export type ReminderKind = "before" | "due" | "late";
export type ReminderSettings = { remindBeforeDays: number; remindLateEvery: number };

export type DueItem = {
  slotId: string;
  period: number;
  kind: ReminderKind;
  due: string;
  /** Whole days late after the grace days; 0 unless kind is "late". */
  daysLate: number;
  /** Days from today to the due day; negative once the due day has passed. */
  daysUntil: number;
  /** True when a reminder is scheduled for today under the committee's reminder settings. */
  remindToday: boolean;
};

const DAY = 24 * 60 * 60 * 1000;
const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);

/**
 * Every unpaid instalment that needs attention today, soonest first: due within the reminder window ("before"),
 * due today or still inside the grace days ("due"), or past the grace days ("late"). Months further away than the
 * window are left out. A reminder is scheduled (`remindToday`) exactly N days before the due day, on the due day,
 * and on the first late day and then every `remindLateEvery` days while the instalment stays unpaid.
 */
export function dueList(terms: CommitteeTerms, settings: ReminderSettings, today: string, slotIds: string[], paid: PaidRecord[]): DueItem[] {
  const paidKeys = new Set(paid.map((p) => `${p.slotId}|${p.period}`));
  const items: DueItem[] = [];
  for (let period = 1; period <= terms.periods; period++) {
    const due = dueDateFor(terms.startDate, terms.dueDay, period);
    const daysUntil = dayNumber(due) - dayNumber(today);
    if (daysUntil > settings.remindBeforeDays) break; // every later month is further away still
    for (const slotId of slotIds) {
      if (paidKeys.has(`${slotId}|${period}`)) continue;
      const daysLate = lateByDays(due, today, terms.graceDays);
      if (daysUntil > 0) {
        if (settings.remindBeforeDays > 0) items.push({ slotId, period, kind: "before", due, daysLate: 0, daysUntil, remindToday: daysUntil === settings.remindBeforeDays });
      } else if (daysLate === 0) {
        items.push({ slotId, period, kind: "due", due, daysLate: 0, daysUntil, remindToday: daysUntil === 0 });
      } else {
        items.push({ slotId, period, kind: "late", due, daysLate, daysUntil, remindToday: (daysLate - 1) % settings.remindLateEvery === 0 });
      }
    }
  }
  const order: Record<ReminderKind, number> = { late: 0, due: 1, before: 2 };
  return items.sort((a, b) => order[a.kind] - order[b.kind] || b.daysLate - a.daysLate || a.daysUntil - b.daysUntil || a.period - b.period);
}

/**
 * A phone number as WhatsApp wants it: digits only, with the country code (92 for Pakistan).
 * "0300 1234567", "+92 300 1234567" and "0092-300-1234567" all give 923001234567. Null when it can't be a phone number.
 */
export function whatsappNumber(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) digits = `92${digits.slice(1)}`;
  else if (digits.length === 10 && digits.startsWith("3")) digits = `92${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

export type MessageParts = { name: string; committee: string; amountText: string; start: string; period: number; kind: ReminderKind; due: string; dueText: string; daysLate: number };

/** The message for one person. Polite and short; it names the amount, the month and the day, never anyone else. */
export function reminderMessage(m: MessageParts): string {
  const month = periodLabel(m.start, m.period);
  const what = `your ${m.committee} kameti instalment of ${m.amountText} for ${month}`;
  const hello = `Assalam o Alaikum ${m.name},`;
  if (m.kind === "before") return `${hello} a reminder that ${what} is due on ${m.dueText}. Thank you.`;
  if (m.kind === "due") return `${hello} a reminder that ${what} is due on ${m.dueText}. Thank you.`;
  return `${hello} ${what} was due on ${m.dueText} and is ${m.daysLate} day${m.daysLate === 1 ? "" : "s"} late. Please send it when you can. Thank you.`;
}

/** An ordinary WhatsApp link with the text filled in; the organiser reads it and presses send. Null without a usable phone number. */
export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

/** The plain-text body of the daily email to the organiser. */
export function summaryText(committee: string, today: string, lines: { who: string; month: string; kind: ReminderKind; daysLate: number }[]): string {
  if (lines.length === 0) return `${committee}: nothing is due or late today.`;
  const word: Record<ReminderKind, (daysLate: number) => string> = {
    before: () => "due soon",
    due: () => "due today",
    late: (n) => `late by ${n} day${n === 1 ? "" : "s"}`,
  };
  return [`${committee}, ${today}:`, ...lines.map((l) => `- ${l.who}, ${l.month}: ${word[l.kind](l.daysLate)}`)].join("\n");
}
