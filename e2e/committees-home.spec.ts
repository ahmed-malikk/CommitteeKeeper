import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, addMembers, createCommittee, hasLogin, startCommitteeOnPage } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

test.describe("the organiser's home screen (US-22)", () => {
  test("a running committee shows how many are late, and the long-late ones are listed first", async ({ page }) => {
    test.setTimeout(180_000);
    const name = `Home ${Date.now()}`;
    // Began in January 2026 with 2 periods and nothing recorded: 2 slots x 2 periods = 4 late instalments.
    const url = await createCommittee(page, { periods: 2, order: "Set the order by hand", startDate: "2026-01-15", name });
    await addMembers(page, url, ["Ali", "مریم خان"]);
    await page.goto(`${url}/turns`);
    await page.getByRole("button", { name: "Move Ali later" }).click();
    await page.getByRole("button", { name: "Save order" }).click();
    await expect(page.getByText("Order saved.")).toBeVisible();
    await startCommitteeOnPage(page, url);

    await page.goto("/committees");
    const row = page.getByRole("region", { name: "All committees" }).getByRole("link", { name: new RegExp(name) });
    await expect(row).toContainText("You organise");
    await expect(row).toContainText("4 late");
    await expect(row).toContainText("Running");

    const needs = page.getByRole("region", { name: "Needs you today" });
    await expect(needs).toBeVisible();
    // Every line says who is how many days late.
    await expect(needs.getByRole("link").first()).toContainText(/is late by \d+ days?/);
  });

  test("a committee that has not started shows no late count", async ({ page }) => {
    test.setTimeout(120_000);
    const name = `Forming ${Date.now()}`;
    await createCommittee(page, { periods: 2, order: "Draw each month", name });
    await page.goto("/committees");
    const row = page.getByRole("region", { name: "All committees" }).getByRole("link", { name: new RegExp(name) });
    await expect(row).toContainText("Forming");
    await expect(row).not.toContainText("late");
  });

  test("the home screen fits a phone and a long Urdu-script name does not break it", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const name = `بہت لمبا نام والی کمیٹی ${stamp} Very Long Name For The Area`;
    await createCommittee(page, { periods: 2, order: "Draw each month", name });
    await page.goto("/committees");
    await expect(page.getByRole("link", { name: new RegExp(String(stamp)) })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
