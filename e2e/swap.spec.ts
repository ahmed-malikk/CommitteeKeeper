import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, addMembers, createCommittee, hasLogin, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

test.describe("swapping two turns", () => {
  test("swap, with a reason, changes only the places and is one entry in the history (FR-10)", async ({ page }) => {
    test.setTimeout(180_000);
    const { url, order } = await runningByHand(page, ["Ali", "Sara", "Hira"]);
    expect(order).toEqual(["Sara", "Ali", "Hira"]);

    await page.goto(`${url}/turns`);
    await expect(page.locator(".turns .li .t")).toHaveText(["Sara", "Ali", "Hira"]);

    const form = page.getByRole("form", { name: "Swap two turns" });
    // The same turn cannot be chosen on both sides.
    await form.getByLabel("First turn").selectOption({ label: "Turn 1 · Sara" });
    await expect(form.getByLabel("Second turn").getByRole("option", { name: "Turn 1 · Sara" })).toBeDisabled();
    await form.getByLabel("Second turn").selectOption({ label: "Turn 3 · Hira" });
    await form.getByLabel("Reason").fill("Hira asked for an earlier turn");
    await form.getByRole("button", { name: "Swap these turns" }).click();

    await expect(page.getByText("Swapped. The change is in the history below.")).toBeVisible();
    await expect(page.locator(".turns .li .t")).toHaveText(["Hira", "Ali", "Sara"]);

    // One entry, with both old and new places and the reason.
    await expect(page.locator("#swaps-h")).toBeVisible();
    await expect(page.locator(".drawlog .li")).toHaveCount(1);
    await expect(page.getByText("Sara: turn 1 to 3. Hira: turn 3 to 1.")).toBeVisible();
    await expect(page.getByText("Reason: Hira asked for an earlier turn")).toBeVisible();

    // No money amount changes: the pot and what each member owes are the same as before.
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page.getByText("3 slots. The pot is Rs 3,000 each period.")).toBeVisible();
    await expect(page.getByText("1 slot · owes Rs 1,000 each period")).toHaveCount(3);
  });

  test("there is no swap form while the committee is still forming", async ({ page }) => {
    test.setTimeout(120_000);
    const url = await createCommittee(page, { periods: 2, order: "Set the order by hand" });
    await addMembers(page, url, ["Ali", "Sara"]);
    await page.goto(`${url}/turns`);
    await expect(page.getByRole("form", { name: "Swap two turns" })).toHaveCount(0);
  });

  test("the reason is required and the swap form fits a 375 px phone", async ({ page }) => {
    test.setTimeout(180_000);
    const { url } = await runningByHand(page, ["Ali", "Sara"]);
    await page.goto(`${url}/turns`);
    const form = page.getByRole("form", { name: "Swap two turns" });
    await expect(form.getByLabel("Reason")).toHaveAttribute("required", "");
    await expect(form.getByRole("button", { name: "Swap these turns" })).toBeDisabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
