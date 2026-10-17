import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, committeeWithMembers, createCommittee, addMembers, hasLogin, startCommitteeOnPage } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

test.describe("draws", () => {
  test("a start draw gives every turn one place, and a redo keeps the first result in the history (FR-4)", async ({ page }) => {
    test.setTimeout(150_000);
    const url = await createCommittee(page, { periods: 3, order: "Draw all turns at the start" });
    await addMembers(page, url, ["Ali", "Sara", "Hira"]);
    await page.goto(`${url}/turns`);

    // Nothing is drawn yet: no places, no history.
    await expect(page.getByText("No place yet")).toHaveCount(3);
    await expect(page.getByRole("heading", { name: "Draw history" })).toHaveCount(0);

    await page.getByRole("button", { name: "Draw all turns" }).click();
    await expect(page.getByText("Drawn. The result is in the history below.")).toBeVisible();

    // Every turn appears exactly once, in places 1, 2 and 3.
    await expect(page.locator(".turns .pos")).toHaveText(["1", "2", "3"]);
    const drawn = await page.locator(".turns .li .t").allInnerTexts();
    expect([...drawn].sort()).toEqual(["Ali", "Hira", "Sara"]);
    await expect(page.locator(".drawlog .li")).toHaveCount(1);

    // A redo adds a second entry and keeps the first.
    await page.getByRole("form", { name: "Draw all turns" }).getByLabel("Reason (optional)").fill("Hira was not there");
    await page.getByRole("button", { name: "Redo the draw" }).click();
    await expect(page.getByText("Redone. The earlier result stays in the history below.")).toBeVisible();
    await expect(page.locator(".drawlog .li")).toHaveCount(2);
    await expect(page.locator(".drawlog .li .t")).toHaveText(["Draw redone", "Draw"]);
    await expect(page.getByText("Reason: Hira was not there")).toBeVisible();
    await expect(page.locator(".turns .pos")).toHaveText(["1", "2", "3"]);
  });

  test("a month-by-month draw picks only turns without a place, and the last draw can be redone", async ({ page }) => {
    test.setTimeout(180_000);
    const url = await committeeWithMembers(page, { order: "Draw each month", names: ["Ali", "Sara"] });

    // While forming, the monthly draw is not available yet.
    await page.goto(`${url}/turns`);
    await expect(page.getByText("The drawing starts once the committee is running.")).toBeVisible();

    await startCommitteeOnPage(page, url);
    await page.goto(`${url}/turns`);
    await page.getByRole("button", { name: "Draw the next turn" }).click();
    await expect(page.getByText("Drawn. The result is in the history below.")).toBeVisible();
    await expect(page.locator(".drawlog .li")).toHaveCount(1);
    await expect(page.locator(".drawlog .li .s").first()).toContainText("Turn 1:");

    // Redo the last draw: the first result stays, a second entry is added.
    await page.getByRole("form", { name: "Redo the last draw" }).getByLabel("Reason (optional)").fill("Drawn by mistake");
    await page.getByRole("button", { name: "Redo the last draw" }).click();
    await expect(page.getByText("Redone. The earlier result stays in the history below.")).toBeVisible();
    await expect(page.locator(".drawlog .li")).toHaveCount(2);

    await page.getByRole("button", { name: "Draw the next turn" }).click();
    await expect(page.locator(".drawlog .li")).toHaveCount(3);
    await expect(page.locator(".turns .pos")).toHaveText(["1", "2"]);

    // Everything has a place now, so there is nothing left to draw.
    await expect(page.getByText("Every turn has its place, so there is nothing left to draw.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Draw the next turn" })).toBeDisabled();
  });

  test("the way of deciding turns can be changed; while running it needs a reason (TC-015)", async ({ page }) => {
    test.setTimeout(180_000);
    const url = await committeeWithMembers(page, { order: "Draw each month", names: ["Ali", "Sara"] });
    await page.goto(`${url}/turns`);

    // Forming: no reason needed.
    await page.getByText("Change how turns are decided").click();
    const form = page.getByRole("form", { name: "Change how turns are decided" });
    await form.getByText("Set the order by hand", { exact: true }).click();
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved. The way of deciding turns has changed.")).toBeVisible();
    await expect(page.getByText("Turns are decided by:")).toContainText("Set the order by hand");
    await expect(page.getByRole("form", { name: "Arrange the turns" })).toBeVisible();

    // Back to a monthly draw so the committee can start, then try to change it while running without a reason.
    await page.getByText("Change how turns are decided").click();
    await page.getByRole("form", { name: "Change how turns are decided" }).getByText("Draw each month", { exact: true }).click();
    await page.getByRole("form", { name: "Change how turns are decided" }).getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Turns are decided by:")).toContainText("Draw each month");

    await startCommitteeOnPage(page, url);
    await page.goto(`${url}/turns`);
    await page.getByText("Change how turns are decided").click();
    const running = page.getByRole("form", { name: "Change how turns are decided" });
    await running.getByText("Draw all turns at the start", { exact: true }).click();
    // The reason field is required, so the browser itself stops an empty save.
    await expect(running.getByLabel("Reason")).toHaveAttribute("required", "");
    await running.getByLabel("Reason").fill("Everyone agreed to draw it all at once");
    await running.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved. The way of deciding turns has changed.")).toBeVisible();
    await expect(page.getByText("Turns are decided by:")).toContainText("Draw all turns at the start");
  });
});
