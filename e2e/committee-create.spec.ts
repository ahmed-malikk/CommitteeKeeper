import { expect, test, type Page } from "@playwright/test";
import { LISTS_STATE, hasLogin } from "./helpers";

test.use({ storageState: LISTS_STATE });
test.skip(!hasLogin, "needs the test login");

const next = (page: Page) => page.getByRole("button", { name: "Next" }).click();

async function fillBasics(page: Page, v: { name: string; amount: string; periods: string }) {
  await page.getByLabel("Committee name").fill(v.name);
  await page.getByLabel("Instalment (Rs per period)").fill(v.amount);
  await page.getByLabel("Number of periods (2 to 30)").fill(v.periods);
}

test.describe("new committee", () => {
  test("each bad answer gets its own message and stops the flow (TC-005)", async ({ page }) => {
    await page.goto("/committees/new");
    await next(page);
    await expect(page.getByText("Give the committee a name.")).toBeVisible();
    await expect(page.getByText("Enter the instalment amount in rupees.")).toBeVisible();
    await expect(page.getByText("Enter the number of periods (months).")).toBeVisible();

    await fillBasics(page, { name: "Cousins", amount: "0", periods: "31" });
    await next(page);
    await expect(page.getByText("The amount must be more than Rs 0.")).toBeVisible();
    await expect(page.getByText("Use 2 to 30 periods.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "The basics" })).toBeVisible();
  });

  test("pressing Enter moves to the next step instead of creating the committee", async ({ page }) => {
    await page.goto("/committees/new");
    await fillBasics(page, { name: "Enter test", amount: "1000", periods: "4" });
    await page.getByLabel("Committee name").press("Enter");
    await expect(page.getByRole("heading", { name: "How are the turns decided?" })).toBeVisible();
  });

  test("an organiser creates a committee and sees its agreement, in lakh style (TC-006, TC-007)", async ({ page }) => {
    test.setTimeout(90_000);
    const name = `کمیٹی ${Date.now()} ${"طویل نام ".repeat(5)}`.trim();
    await page.goto("/committees/new");
    await fillBasics(page, { name, amount: "250000", periods: "12" });
    await next(page);
    await page.getByText("Set the order by hand").click();
    await next(page);
    await page.getByText("Rs. 12,000/-").click();
    await page.getByText("12,00,000").click();
    await page.getByText("Whose turn it is").click();
    await page.getByRole("button", { name: "Create committee" }).click();

    await expect(page).toHaveURL(/\/committees\/[0-9a-f-]{36}\?created=1$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1 })).toContainText("کمیٹی");
    await expect(page.getByText("Rs. 2,50,000/- per period")).toBeVisible();
    await expect(page.getByText("Set the order by hand", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Print agreement" })).toBeVisible();

    // A long Urdu-script name must not push the page sideways.
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(wide).toBe(false);

    await page.getByRole("link", { name: "My committees" }).first().click();
    await expect(page).toHaveURL(/\/committees$/);
    await expect(page.getByRole("link", { name: /کمیٹی/ }).first()).toBeVisible();
  });

  test("a committee that does not exist is not found", async ({ page }) => {
    await page.goto("/committees/00000000-0000-4000-8000-000000000000");
    await expect(page.getByText("This page could not be found.")).toBeVisible();
    await expect(page.getByText("Agreement")).toHaveCount(0);
  });
});
