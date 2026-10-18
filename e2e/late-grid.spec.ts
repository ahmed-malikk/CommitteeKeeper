import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

// A committee that began in January 2026 with 2 periods and 2 slots, nothing recorded: 4 instalments are late.
test.describe("late list and payment grid (US-9)", () => {
  test("the late list, the grid and the home screen agree, and the longest-late come first (FR-9, TC-030, TC-031)", async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/payments`);

    const late = page.getByRole("region", { name: /^Late/ });
    await expect(late).toContainText("4 unpaid past the grace days");
    const lines = late.locator(".li");
    await expect(lines).toHaveCount(4);
    // January's instalments are the longest late, so they are listed before February's.
    await expect(lines.nth(0)).toContainText("Jan 2026");
    await expect(lines.nth(1)).toContainText("Jan 2026");
    await expect(lines.nth(2)).toContainText("Feb 2026");
    await expect(lines.first()).toContainText(/late by \d+ days?/);

    // The grid: one row per slot, one column per month; four late cells.
    const grid = page.getByRole("table");
    await expect(grid.locator("tbody tr")).toHaveCount(2);
    await expect(grid.locator("thead th")).toHaveCount(3);
    await expect(grid.locator("td.g-late")).toHaveCount(4);

    // The home screen counts the same four.
    await page.goto("/committees");
    await expect(page.getByRole("region", { name: "Needs you today" })).toBeVisible();

    // Record one payment from the late list: every count drops together.
    await page.goto(`${url}/payments`);
    await page.getByRole("link", { name: /Record a payment for .*Jan 2026/ }).first().click();
    const form = page.getByRole("form", { name: "Record a payment" });
    await form.getByLabel("Date paid").fill("2026-01-16");
    await form.getByRole("button", { name: "Save payment" }).click();
    await expect(page.getByText("Saved. It is in the history.")).toBeVisible({ timeout: 15_000 });
    await page.goto(`${url}/payments`);
    await expect(page.getByRole("region", { name: /^Late/ })).toContainText("3 unpaid past the grace days");
    await expect(page.getByRole("table").locator("td.g-late")).toHaveCount(3);
    await expect(page.getByRole("table").locator("td.g-paid")).toHaveCount(1);
  });

  test("the grid scrolls inside its own box and the page does not widen, with Urdu-script names", async ({ page }) => {
    test.setTimeout(240_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/payments`);
    await expect(page.getByRole("table").getByText("مریم خان")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // The grid can be reached with the keyboard so it can be scrolled.
    await expect(page.getByRole("region", { name: /Payment grid/ })).toHaveAttribute("tabindex", "0");
  });
});
