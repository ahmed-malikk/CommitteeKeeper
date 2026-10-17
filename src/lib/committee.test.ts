import { describe, expect, it } from "vitest";
import {
  canMove,
  completeProblems,
  isAllowed,
  lastDueDate,
  startProblems,
  type CommitteeInfo,
  type SlotInfo,
} from "./committee";

/** A slot that is ready: someone holds it and it has a place in the order. */
const slot = (position: number | null = 1, extra: Partial<SlotInfo> = {}): SlotInfo => ({
  hasHolder: true,
  position,
  paidOut: false,
  ...extra,
});

/** A committee that is ready to start: 3 slots, 3 periods, Rs 1,000, order set. Change one thing per test. */
function committee(extra: Partial<CommitteeInfo> = {}): CommitteeInfo {
  return {
    status: "forming",
    amount: 1000,
    periods: 3,
    startDate: "2026-01-01",
    dueDay: 5,
    orderMethod: "hand",
    slots: [slot(1), slot(2), slot(3)],
    ...extra,
  };
}

describe("Task 1 canMove", () => {
  it("allows forming to running", () => {
    expect(canMove("forming", "running")).toBe(true);
  });

  it("allows running to completed", () => {
    expect(canMove("running", "completed")).toBe(true);
  });

  it("never goes backwards", () => {
    expect(canMove("running", "forming")).toBe(false);
    expect(canMove("completed", "running")).toBe(false);
    expect(canMove("completed", "forming")).toBe(false);
  });

  it("never skips a step (TC-017: complete before it has started)", () => {
    expect(canMove("forming", "completed")).toBe(false);
  });

  it("never stays in place", () => {
    expect(canMove("forming", "forming")).toBe(false);
    expect(canMove("running", "running")).toBe(false);
    expect(canMove("completed", "completed")).toBe(false);
  });
});

describe("Task 2 startProblems", () => {
  it("returns an empty list for a committee that is ready", () => {
    expect(startProblems(committee())).toEqual([]);
  });

  it("asks for an amount", () => {
    expect(startProblems(committee({ amount: 0 }))).toEqual(["Set the instalment amount"]);
  });

  it("asks for a start date", () => {
    expect(startProblems(committee({ startDate: null }))).toEqual(["Set the start date"]);
  });

  it("needs at least 2 slots (and the slots must match the periods)", () => {
    expect(startProblems(committee({ periods: 1, slots: [slot(1)] }))).toEqual(["Add at least 2 slots"]);
  });

  it("needs as many slots as periods", () => {
    expect(startProblems(committee({ periods: 4 }))).toEqual([
      "The number of slots (3) must equal the number of periods (4)",
    ]);
  });

  it("needs a holder for every slot", () => {
    const slots = [slot(1), slot(2, { hasHolder: false }), slot(3)];
    expect(startProblems(committee({ slots }))).toEqual(["Every slot needs a holder"]);
  });

  it("needs the turn order when turns are set by hand or drawn at the start", () => {
    const slots = [slot(1), slot(null), slot(3)];
    const message = "Set the turn order first (by hand or by the start draw)";
    expect(startProblems(committee({ slots, orderMethod: "hand" }))).toEqual([message]);
    expect(startProblems(committee({ slots, orderMethod: "draw_start" }))).toEqual([message]);
  });

  it("does not need the order when turns are drawn month by month", () => {
    const slots = [slot(null), slot(null), slot(null)];
    expect(startProblems(committee({ slots, orderMethod: "draw_monthly" }))).toEqual([]);
  });

  it("lists every problem together, in this order", () => {
    const empty = committee({
      amount: 0,
      startDate: null,
      periods: 4,
      slots: [slot(null, { hasHolder: false })],
    });
    expect(startProblems(empty)).toEqual([
      "Set the instalment amount",
      "Set the start date",
      "Add at least 2 slots",
      "The number of slots (1) must equal the number of periods (4)",
      "Every slot needs a holder",
      "Set the turn order first (by hand or by the start draw)",
    ]);
  });

  it("refuses to start a committee that is not forming", () => {
    const message = ["A committee can only be started while it is forming"];
    expect(startProblems(committee({ status: "running" }))).toEqual(message);
    expect(startProblems(committee({ status: "completed" }))).toEqual(message);
  });
});

describe("Task 3 lastDueDate", () => {
  it("is (periods - 1) months after the start month, on the due day", () => {
    expect(lastDueDate("2026-01-01", 3, 5)).toBe("2026-03-05");
  });

  it("does not depend on the day of the start date", () => {
    expect(lastDueDate("2026-01-31", 3, 5)).toBe("2026-03-05");
  });

  it("crosses a year end", () => {
    expect(lastDueDate("2026-11-10", 4, 1)).toBe("2027-02-01");
  });

  it("works for a 12-month committee", () => {
    expect(lastDueDate("2026-01-01", 12, 5)).toBe("2026-12-05");
  });

  it("handles the last day a due day can be (28th) in February", () => {
    expect(lastDueDate("2027-01-15", 2, 28)).toBe("2027-02-28");
  });
});

describe("Task 4 completeProblems", () => {
  const finished = committee({
    status: "running",
    slots: [slot(1, { paidOut: true }), slot(2, { paidOut: true }), slot(3, { paidOut: true })],
  });

  it("returns an empty list when the last period has passed and every turn is paid out", () => {
    expect(completeProblems(finished, "2026-03-05", 0, null)).toEqual([]);
  });

  it("refuses a committee that has not started (TC-017)", () => {
    expect(completeProblems(committee(), "2030-01-01", 0, null)).toEqual([
      "A committee cannot be completed before it has started",
    ]);
  });

  it("refuses a committee that is already completed", () => {
    expect(completeProblems({ ...finished, status: "completed" }, "2030-01-01", 0, null)).toEqual([
      "This committee is already completed",
    ]);
  });

  it("refuses before the last period is over", () => {
    expect(completeProblems(finished, "2026-03-04", 0, null)).toEqual([
      "The last period is not over yet (last due day 2026-03-05)",
    ]);
  });

  it("counts the turns that are not paid out yet", () => {
    const slots = [slot(1, { paidOut: true }), slot(2), slot(3)];
    expect(completeProblems({ ...finished, slots }, "2026-03-05", 0, null)).toEqual([
      "2 turn(s) have not been paid out",
    ]);
  });

  it("needs a settlement note when payments are not recorded", () => {
    expect(completeProblems(finished, "2026-03-05", 8, null)).toEqual([
      "8 payment(s) are not recorded; record them, or say how they were settled",
    ]);
  });

  it("treats a blank note as no note", () => {
    expect(completeProblems(finished, "2026-03-05", 8, "   ")).toHaveLength(1);
  });

  it("accepts unrecorded payments when a settlement note is given", () => {
    expect(completeProblems(finished, "2026-03-05", 8, "settled in cash")).toEqual([]);
  });

  it("lists every problem together", () => {
    const slots = [slot(1), slot(2, { paidOut: true }), slot(3)];
    expect(completeProblems({ ...finished, slots }, "2026-02-01", 4, null)).toEqual([
      "The last period is not over yet (last due day 2026-03-05)",
      "2 turn(s) have not been paid out",
      "4 payment(s) are not recorded; record them, or say how they were settled",
    ]);
  });
});

describe("Task 5 isAllowed", () => {
  it("lets a forming committee change its agreement and its slots", () => {
    for (const action of ["update_settings", "add_slot", "remove_slot", "remove_member", "start"] as const) {
      expect(isAllowed("forming", action), action).toBe(true);
    }
  });

  it("fixes the agreement once the committee is running", () => {
    for (const action of ["update_settings", "add_slot", "remove_slot", "remove_member", "start"] as const) {
      expect(isAllowed("running", action), action).toBe(false);
    }
  });

  it("allows money records only while running", () => {
    const money = ["record_payment", "correct_payment", "attach_receipt", "remove_receipt", "record_payout"] as const;
    for (const action of money) {
      expect(isAllowed("running", action), action).toBe(true);
      expect(isAllowed("forming", action), action).toBe(false);
    }
  });

  it("allows swaps, replacements, the monthly draw and completing only while running", () => {
    for (const action of ["swap_turns", "replace_holder", "draw_next", "complete"] as const) {
      expect(isAllowed("running", action), action).toBe(true);
      expect(isAllowed("forming", action), action).toBe(false);
    }
  });

  it("allows members, order, visibility and the start draw while forming or running", () => {
    const both = [
      "add_member", "update_member", "set_visibility", "set_order", "set_order_method",
      "record_agreement", "set_member_link", "draw_all",
    ] as const;
    for (const action of both) {
      expect(isAllowed("forming", action), action).toBe(true);
      expect(isAllowed("running", action), action).toBe(true);
    }
  });

  it("allows nothing once completed (TC-020: read-only)", () => {
    const all = [
      "update_settings", "add_slot", "remove_slot", "remove_member", "start", "add_member", "update_member",
      "set_visibility", "set_order", "set_order_method", "record_agreement", "set_member_link", "draw_all",
      "record_payment", "correct_payment", "attach_receipt", "remove_receipt", "record_payout",
      "swap_turns", "replace_holder", "draw_next", "complete",
    ] as const;
    for (const action of all) {
      expect(isAllowed("completed", action), action).toBe(false);
    }
  });
});
