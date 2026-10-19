import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, runningByHand, tokenOf } from "./helpers";

test.describe("the privacy page (US-23)", () => {
  test.use({ storageState: SIGNED_OUT });

  test("says what is stored, who can see it, and what permanent means for deletion (FR-21)", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    for (const heading of ["What is stored", "Who can see it", "Why the history is permanent", "What this means for deleting things"]) {
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(text).toContain("can never be edited or deleted");
    expect(text).toContain("It never holds or moves money");
    expect(text).toContain("no advertising or tracking cookies");
    expect(text).not.toMatch(/lorem|TODO|TBD/i);
  });

  test("is reachable from the footer, from sign-up, and from a member's link page (FR-21)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.goto("/sign-up");
    await page.getByRole("link", { name: "read the privacy page" }).click();
    await expect(page).toHaveURL(/\/privacy$/);

    // Even the answer for a link that does not work has the footer, so the way to the privacy page is one tap.
    await page.goto(`/m/${"A".repeat(43)}`);
    await page.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test("fits a phone", async ({ page }) => {
    await page.goto("/privacy");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe("the privacy page from inside the app and from a member link", () => {
  test.use({ storageState: ORGANISER_STATE });
  test.skip(!hasLogin, "needs the test login");

  test("opens from the rail on a laptop and the top bar on a phone", async ({ page }) => {
    await page.goto("/committees");
    await page.getByRole("link", { name: "Privacy" }).first().click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test("a working member link has it too", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "Ali");
    const context = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
    const member = await context.newPage();
    await member.goto(`/m/${token}`);
    await expect(member.getByText("Hello Ali")).toBeVisible();
    await member.getByRole("link", { name: "Privacy" }).click();
    await expect(member).toHaveURL(/\/privacy$/);
    await context.close();
  });
});
