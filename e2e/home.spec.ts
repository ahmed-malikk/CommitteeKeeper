import { expect, test } from "@playwright/test";

test("home page loads with the product name", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/CommitteeKeeper/);
  await expect(page.getByRole("heading", { name: "CommitteeKeeper" })).toBeVisible();
});

test("home page has no sideways scroll", async ({ page }) => {
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
