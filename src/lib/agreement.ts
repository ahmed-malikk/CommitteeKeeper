import type { DisplayGrouping, DisplayStyle } from "./money";

export type OrderMethod = "hand" | "draw_start" | "draw_monthly";

/** Everything the organiser sets in the guided flow: the committee's written agreement. */
export type AgreementInput = {
  name: string;
  amount: string;
  periods: string;
  startDate: string;
  dueDay: string;
  graceDays: string;
  orderMethod: string;
  remindBeforeDays: string;
  remindLateEvery: string;
  displayStyle: string;
  displayGrouping: string;
  membersSeePayments: boolean;
  membersSeeTurns: boolean;
  membersSeeHistory: boolean;
};

export type Agreement = {
  name: string;
  amount: number;
  periods: number;
  startDate: string;
  dueDay: number;
  graceDays: number;
  orderMethod: OrderMethod;
  remindBeforeDays: number;
  remindLateEvery: number;
  displayStyle: DisplayStyle;
  displayGrouping: DisplayGrouping;
  membersSeePayments: boolean;
  membersSeeTurns: boolean;
  membersSeeHistory: boolean;
};

export type AgreementField = keyof AgreementInput;
export type AgreementProblems = Partial<Record<AgreementField, string>>;

export const NAME_MAX = 80;
// Rs 1 crore per instalment: far above any kameti, and keeps pot totals inside the database's integer range.
export const AMOUNT_MAX = 10_000_000;

export const ORDER_LABELS: Record<OrderMethod, string> = {
  draw_start: "Draw all turns at the start",
  draw_monthly: "Draw each month",
  hand: "Set the order by hand",
};

/** The guided flow's steps and which fields each one owns, so an error can send the person back to its step. */
export const STEP_FIELDS: AgreementField[][] = [
  ["name", "amount", "periods", "startDate", "dueDay", "graceDays"],
  ["orderMethod"],
  ["remindBeforeDays", "remindLateEvery", "displayStyle", "displayGrouping"],
];

const wholeNumber = (text: string): number | null => (/^\d{1,10}$/.test(text.trim()) ? Number(text.trim()) : null);

function isRealDate(text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

/** Checks one set of answers. Each problem has its own message, so the form can say exactly what to fix. */
export function validateAgreement(input: AgreementInput): { agreement: Agreement | null; problems: AgreementProblems } {
  const problems: AgreementProblems = {};

  const name = input.name.trim();
  if (name === "") problems.name = "Give the committee a name.";
  else if ([...name].length > NAME_MAX) problems.name = `Keep the name to ${NAME_MAX} characters or fewer.`;

  const amount = wholeNumber(input.amount);
  if (input.amount.trim() === "") problems.amount = "Enter the instalment amount in rupees.";
  else if (amount === null) problems.amount = "Use whole rupees only, with digits and no commas.";
  else if (amount === 0) problems.amount = "The amount must be more than Rs 0.";
  else if (amount > AMOUNT_MAX) problems.amount = "That amount is too large. Check the number of zeros.";

  const periods = wholeNumber(input.periods);
  if (input.periods.trim() === "") problems.periods = "Enter the number of periods (months).";
  else if (periods === null || periods < 2 || periods > 30) problems.periods = "Use 2 to 30 periods.";

  if (!isRealDate(input.startDate)) problems.startDate = "Choose the start date.";

  const dueDay = wholeNumber(input.dueDay);
  if (dueDay === null || dueDay < 1 || dueDay > 28) problems.dueDay = "Pick a due day from 1 to 28, so it exists in every month.";

  const graceDays = wholeNumber(input.graceDays);
  if (graceDays === null || graceDays > 28) problems.graceDays = "Use 0 to 28 grace days.";

  if (!["hand", "draw_start", "draw_monthly"].includes(input.orderMethod)) problems.orderMethod = "Choose how turns are decided.";

  const remindBefore = wholeNumber(input.remindBeforeDays);
  if (remindBefore === null || remindBefore > 14) problems.remindBeforeDays = "Use 0 to 14 days before the due day.";

  const remindEvery = wholeNumber(input.remindLateEvery);
  if (remindEvery === null || remindEvery < 1 || remindEvery > 14) problems.remindLateEvery = "Use 1 to 14 days between late reminders.";

  if (!["rs", "rs_dash"].includes(input.displayStyle)) problems.displayStyle = "Choose how amounts look.";
  if (!["western", "lakh"].includes(input.displayGrouping)) problems.displayGrouping = "Choose how digits are grouped.";

  if (Object.keys(problems).length > 0) return { agreement: null, problems };
  return {
    problems,
    agreement: {
      name,
      amount: amount!,
      periods: periods!,
      startDate: input.startDate,
      dueDay: dueDay!,
      graceDays: graceDays!,
      orderMethod: input.orderMethod as OrderMethod,
      remindBeforeDays: remindBefore!,
      remindLateEvery: remindEvery!,
      displayStyle: input.displayStyle as DisplayStyle,
      displayGrouping: input.displayGrouping as DisplayGrouping,
      membersSeePayments: input.membersSeePayments,
      membersSeeTurns: input.membersSeeTurns,
      membersSeeHistory: input.membersSeeHistory,
    },
  };
}

/** Only the fields belonging to one step, so "Next" can check just that step. */
export function problemsForStep(problems: AgreementProblems, step: number): AgreementProblems {
  const out: AgreementProblems = {};
  for (const f of STEP_FIELDS[step] ?? []) if (problems[f]) out[f] = problems[f];
  return out;
}

/** The first step that has a problem, or -1. */
export function firstStepWithProblem(problems: AgreementProblems): number {
  return STEP_FIELDS.findIndex((fields) => fields.some((f) => problems[f]));
}

export const DEFAULT_INPUT: Omit<AgreementInput, "startDate"> = {
  name: "",
  amount: "",
  periods: "",
  dueDay: "10",
  graceDays: "0",
  orderMethod: "draw_start",
  remindBeforeDays: "2",
  remindLateEvery: "3",
  displayStyle: "rs",
  displayGrouping: "western",
  membersSeePayments: false,
  membersSeeTurns: false,
  membersSeeHistory: false,
};
