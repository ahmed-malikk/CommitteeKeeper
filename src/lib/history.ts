// The history page in plain words (rules section 7). Pure functions: no database, no screen.
// Every entry in the history is turned into a title, a sentence and an optional reason; the page adds who, when and the number.

export type HistoryEvent = {
  seq: number;
  type: string;
  happenedOn: string;
  recordedAt: string;
  actorId: string | null;
  payload: Record<string, unknown>;
  /** The seq of the entry this one corrects, when it corrects one. */
  correctsSeq: number | null;
  hash: string;
};

export type Lookups = {
  member: (id: string) => string;
  slot: (id: string) => string;
  money: (n: number) => string;
  /** "Jan 2026" for a period number. */
  period: (n: number) => string;
};

export type HistoryLine = { title: string; detail: string; reason: string | null };

const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown) => (typeof v === "number" ? v : null);
const METHOD = { cash: "cash", bank: "bank deposit", easypaisa: "Easypaisa", jazzcash: "JazzCash", other: "other" } as Record<string, string>;
const ORDER = { hand: "set by hand", draw_start: "a draw at the start", draw_monthly: "a draw each month" } as Record<string, string>;

/** "9f2c41ab…": enough of a fingerprint to compare by eye. */
export function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
}

export function describeEvent(e: HistoryEvent, look: Lookups): HistoryLine {
  const p = e.payload;
  const reason = str(p.reason);
  const payer = () => {
    const slot = str(p.slot_id);
    const member = str(p.member_id);
    const period = num(p.period);
    return `${member ? look.member(member) : slot ? look.slot(slot) : "A slot"}${period ? ` for ${look.period(period)}` : ""}`;
  };
  const line = (title: string, detail: string, why: string | null = reason): HistoryLine => ({ title, detail, reason: why });
  const terms = () => `${str(p.name) ?? "The committee"}: ${num(p.amount) !== null ? look.money(p.amount as number) : "an instalment"} a month for ${num(p.periods) ?? "?"} periods.`;

  switch (e.type) {
    case "committee_created":
      return line("Committee created", terms());
    case "settings_set":
      if ("members_see_payments" in p) return line("What members can see was changed", "The organiser changed which parts of the committee members may view.");
      if (str(p.order_method)) return line("Way of deciding turns changed", `Turns are now decided by ${ORDER[p.order_method as string] ?? (p.order_method as string)}.`);
      return line("Agreement saved", terms());
    case "agreement_accepted":
      return line("Agreement accepted", str(p.member_id) ? `${look.member(p.member_id as string)} accepted the agreement.` : "The agreement was accepted.", str(p.note));
    case "member_invited":
      return line("Member added", `${str(p.name) ?? look.member(String(p.member_id ?? ""))} was added to the committee.`);
    case "member_joined":
      return line("Member joined", `${look.member(String(p.member_id ?? ""))} opened their link.`);
    case "member_updated":
      return line("Member renamed", `A member is now called ${str(p.name) ?? "(no name)"}.`);
    case "member_removed":
      return line("Member removed", `${str(p.name) ?? "A member"} was removed before the committee started.`);
    case "slot_added":
      return line("Slot added", `${look.member(String(p.member_id ?? ""))} was given a slot.`);
    case "slot_removed":
      return line("Slot removed", `${look.slot(String(p.slot_id ?? ""))} was removed before the committee started.`);
    case "order_set": {
      const order = Array.isArray(p.order) ? p.order.filter((x): x is string => typeof x === "string") : [];
      return line("Turn order set by hand", order.length > 0 ? order.map(look.slot).join(" → ") : "The turn order was saved.");
    }
    case "draw_done":
    case "draw_redone": {
      const redone = e.type === "draw_redone";
      const order = Array.isArray(p.order) ? p.order.filter((x): x is string => typeof x === "string") : null;
      if (order) return line(redone ? "Draw redone" : "Draw", order.map(look.slot).join(" → "));
      const place = num(p.position);
      const who = look.slot(String(p.slot_id ?? ""));
      return line(redone ? "Last draw redone" : "Next turn drawn", place === null ? who : `Turn ${place}: ${who}`);
    }
    case "committee_started":
      return line("Committee started", "The committee is now running. The agreement and the slots are fixed.");
    case "payment_recorded":
      return line("Payment recorded", `${payer()}: ${num(p.amount) !== null ? look.money(p.amount as number) : "the instalment"} by ${METHOD[String(p.method)] ?? String(p.method ?? "?")}.`);
    case "payment_claimed":
      return line("Payment claimed", `${payer()} was claimed as paid by the member.`);
    case "payment_confirmed":
      return line("Payment confirmed", `${payer()} was confirmed by the organiser.`);
    case "payment_corrected":
      return p.cancelled === true
        ? line("Payment cancelled", `${payer()} was cancelled. The instalment counts as unpaid again.`)
        : line("Payment corrected", `${payer()} was corrected: now paid ${e.happenedOn} by ${METHOD[String(p.method)] ?? String(p.method ?? "?")}.`);
    case "receipt_attached":
      return line("Receipt attached", `Receipt ${num(p.slot_no) ?? "?"} was added to a payment. Fingerprint ${shortHash(String(p.sha256 ?? ""))}`);
    case "receipt_removed":
      return line("Receipt removed", `A receipt was removed from a payment. Fingerprint of the removed file ${shortHash(String(p.sha256 ?? ""))}`);
    case "turn_swapped":
      return line("Turns swapped", `${look.slot(String(p.slot_a ?? ""))}: turn ${num(p.from_a) ?? "?"} to ${num(p.to_a) ?? "?"}. ${look.slot(String(p.slot_b ?? ""))}: turn ${num(p.from_b) ?? "?"} to ${num(p.to_b) ?? "?"}.`);
    case "holder_replaced":
      return line("Member replaced", `${look.member(String(p.leaver_id ?? ""))} leaves ${look.slot(String(p.slot_id ?? ""))}; ${look.member(String(p.replacement_id ?? ""))} takes over from ${num(p.from_period) ? look.period(p.from_period as number) : "a later month"}.`);
    case "payout_recorded": {
      const split = Array.isArray(p.split) ? (p.split as { member_id?: unknown; amount?: unknown }[]) : [];
      const who = split.map((s) => `${look.member(String(s.member_id ?? ""))} ${typeof s.amount === "number" ? look.money(s.amount) : ""}`.trim()).join(" · ");
      return line("Pot handed over", `Turn ${num(p.period) ?? "?"}: ${num(p.amount) !== null ? look.money(p.amount as number) : "the pot"}${who ? ` to ${who}` : ""}.`);
    }
    case "reminder_sent":
      return line("Reminder sent", "The daily reminder run listed who is due or late.");
    case "committee_completed": {
      const missing = num(p.unrecorded_payments) ?? 0;
      return line("Committee completed", missing > 0 ? `Completed with ${missing} unrecorded payment${missing === 1 ? "" : "s"}.` : "Every payment was recorded. The record is now read-only.", str(p.settlement_note));
    }
    default:
      return line(e.type.replace(/_/g, " "), "");
  }
}

/** How the chain check's answer reads: intact, or where it broke. */
export function chainStatus(answer: string | null): { ok: boolean; text: string } {
  if (answer === null) return { ok: false, text: "The check could not be run. Check the connection and refresh the page." };
  if (answer === "ok") return { ok: true, text: "Intact. Every entry is present, in order, and matches its fingerprint." };
  const m = /^broken at entry (\d+): (.*)$/.exec(answer);
  return { ok: false, text: m ? `Broken at entry ${m[1]}: ${m[2]}.` : `The check reported a problem: ${answer}` };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "18 Oct 2026, 11:28 pm" in Pakistan time (UTC+5), from the database's timestamp. */
export function formatRecorded(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const local = new Date(d.getTime() + 5 * 3_600_000);
  const h = local.getUTCHours();
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]} ${local.getUTCFullYear()}, ${hour}:${String(local.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
