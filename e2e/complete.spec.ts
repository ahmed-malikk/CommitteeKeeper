import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, organiserDb, payOutAllTurns, runningByHand, seedCommittee, nextMonthStart } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

test.describe("completing a committee", () => {
  test("a committee that has not started cannot be completed, and says so (TC-017)", async ({ page }) => {
    test.setTimeout(120_000);
    const { url } = await seedCommittee({ names: [], periods: 2, method: "hand" });
    await page.goto(url);
    await expect(page.getByText("A committee can only be completed after it has started.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete committee" })).toHaveCount(0);
  });

  test("before the last period is over, the panel says when it ends and the button stays off", async ({ page }) => {
    test.setTimeout(180_000);
    // The default start date is next month, so the last period is far from over.
    const { url } = await seedCommittee({ names: ["Ali", "Sara"], method: "draw_monthly", periods: 2, startDate: nextMonthStart(), start: true });
    await page.goto(url);
    await expect(page.getByText("The last period is not over yet (last due day")).toBeVisible();
    await expect(page.getByText("2 turn(s) have not been paid out")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete committee" })).toBeDisabled();
  });

  test("finish a committee with a settlement note; afterwards every screen and the database are read-only (FR-5, TC-020)", async ({ page }) => {
    test.setTimeout(240_000);
    // Began in January 2026 with 2 periods, so the last period is long over.
    const { url } = await runningByHand(page, ["Ali", "Sara"]);
    await page.goto(url);
    await expect(page.getByText("2 turn(s) have not been paid out")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete committee" })).toBeDisabled();

    // Every turn gets paid out (the payout screen comes later; the database call is the same one it will make).
    await payOutAllTurns(url);
    await page.goto(url);
    await expect(page.getByText("4 payment(s) are not recorded; record them, or say how they were settled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete committee" })).toBeDisabled();

    // A settlement note says how the missing payments were handled outside the app.
    await page.getByLabel("How were the 4 unrecorded payments settled?").fill("Everyone paid in cash at the monthly meeting");
    await expect(page.getByText("Can’t complete yet:")).toHaveCount(0);
    await page.getByRole("button", { name: "Complete committee" }).click();
    await expect(page.getByText("Complete this committee?")).toBeVisible();
    // Keyboard focus moves into the question, and comes back to the button if the organiser backs out.
    await expect(page.getByRole("group", { name: "Confirm completion" })).toBeFocused();
    await page.getByRole("button", { name: "Not yet" }).click();
    await expect(page.getByRole("button", { name: "Complete committee" })).toBeFocused();
    await page.getByRole("button", { name: "Complete committee" }).click();
    await page.getByRole("button", { name: "Yes, complete it" }).click();

    await expect(page.getByText("This committee is completed. Its record is read-only.")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".head .chip")).toHaveText("Completed");
    await expect(page.getByText("This committee is completed. Its record is read-only: nothing in it can be changed.")).toBeVisible();

    // Members: nothing to add or edit.
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page.getByRole("form", { name: "Add a member" })).toHaveCount(0);
    await expect(page.getByText("Edit details")).toHaveCount(0);
    await expect(page.getByLabel("More slots for Ali")).toHaveCount(0);

    // Turns: no editor, draw, swap or method change.
    await page.getByRole("link", { name: "Turns", exact: true }).click();
    await expect(page.getByRole("form", { name: "Arrange the turns" })).toHaveCount(0);
    await expect(page.getByRole("form", { name: "Swap two turns" })).toHaveCount(0);
    await expect(page.getByText("Change how turns are decided")).toHaveCount(0);
    await expect(page.locator(".turns .li")).toHaveCount(2);

    // The database refuses changes too, whatever the screens show.
    const db = await organiserDb();
    const committeeId = url.split("/").pop() as string;
    const addMember = await db.rpc("add_member", { p_committee_id: committeeId, p_name: "Late arrival", p_email: null, p_phone: null });
    expect(addMember.error).not.toBeNull();
    const method = await db.rpc("set_order_method", { p_committee_id: committeeId, p_method: "hand", p_reason: "should be refused" });
    expect(method.error).not.toBeNull();
    const again = await db.rpc("complete_committee", { p_committee_id: committeeId, p_settlement_note: null });
    expect(again.error?.message).toContain("already completed");
  });
});
