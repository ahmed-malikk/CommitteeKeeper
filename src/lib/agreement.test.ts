import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, firstStepWithProblem, problemsForStep, validateAgreement, type AgreementInput } from "./agreement";

const good: AgreementInput = { ...DEFAULT_INPUT, name: "Cousins Fund", amount: "3000", periods: "6", startDate: "2026-11-01" };

describe("validateAgreement", () => {
  it("accepts a complete agreement and returns real numbers", () => {
    const { agreement, problems } = validateAgreement(good);
    expect(problems).toEqual({});
    expect(agreement).toMatchObject({ name: "Cousins Fund", amount: 3000, periods: 6, dueDay: 10, graceDays: 0, orderMethod: "draw_start" });
  });

  it("trims the name and accepts Urdu-script names", () => {
    expect(validateAgreement({ ...good, name: "  کمیٹی خاندان  " }).agreement?.name).toBe("کمیٹی خاندان");
  });

  it("refuses an empty name, each problem with its own message", () => {
    expect(validateAgreement({ ...good, name: "   " }).problems.name).toBe("Give the committee a name.");
    expect(validateAgreement({ ...good, name: "x".repeat(81) }).problems.name).toMatch(/80 characters/);
  });

  it("refuses an amount of 0, a blank amount and a non-whole amount, differently", () => {
    expect(validateAgreement({ ...good, amount: "0" }).problems.amount).toBe("The amount must be more than Rs 0.");
    expect(validateAgreement({ ...good, amount: "" }).problems.amount).toBe("Enter the instalment amount in rupees.");
    expect(validateAgreement({ ...good, amount: "12,000" }).problems.amount).toMatch(/whole rupees/);
    expect(validateAgreement({ ...good, amount: "1.5" }).problems.amount).toMatch(/whole rupees/);
    expect(validateAgreement({ ...good, amount: "99999999" }).problems.amount).toMatch(/too large/);
  });

  it("allows 2 to 30 periods and nothing else", () => {
    for (const p of ["2", "30"]) expect(validateAgreement({ ...good, periods: p }).problems.periods).toBeUndefined();
    for (const p of ["1", "31", "0", "-3", "abc", ""]) expect(validateAgreement({ ...good, periods: p }).problems.periods).toBeDefined();
  });

  it("checks the date, the due day and the grace days", () => {
    expect(validateAgreement({ ...good, startDate: "" }).problems.startDate).toBeDefined();
    expect(validateAgreement({ ...good, startDate: "2026-02-30" }).problems.startDate).toBeDefined();
    // a committee that is already running may start in the past
    expect(validateAgreement({ ...good, startDate: "2020-01-15" }).problems.startDate).toBeUndefined();
    expect(validateAgreement({ ...good, dueDay: "29" }).problems.dueDay).toBeDefined();
    expect(validateAgreement({ ...good, dueDay: "0" }).problems.dueDay).toBeDefined();
    expect(validateAgreement({ ...good, graceDays: "29" }).problems.graceDays).toBeDefined();
  });

  it("refuses unknown choices", () => {
    expect(validateAgreement({ ...good, orderMethod: "coin-toss" }).problems.orderMethod).toBeDefined();
    expect(validateAgreement({ ...good, displayStyle: "x" }).problems.displayStyle).toBeDefined();
    expect(validateAgreement({ ...good, displayGrouping: "x" }).problems.displayGrouping).toBeDefined();
  });

  it("finds which step to send the person back to", () => {
    const { problems } = validateAgreement({ ...good, orderMethod: "?", remindLateEvery: "0" });
    expect(firstStepWithProblem(problems)).toBe(1);
    expect(Object.keys(problemsForStep(problems, 2))).toEqual(["remindLateEvery"]);
    expect(firstStepWithProblem({})).toBe(-1);
  });
});
