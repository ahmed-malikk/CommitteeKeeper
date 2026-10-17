import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, addMembers, createCommittee, hasLogin } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** The names of the turns in the list, first turn first. */
async function names(page: Page) {
  return page.locator(".turns .li .t").allInnerTexts();
}

test.describe("turn order by hand", () => {
  test("arrange, save with a reason, and the order is still there after a reload (FR-4)", async ({ page }) => {
    test.setTimeout(120_000);
    const url = await createCommittee(page, { periods: 3, order: "Set the order by hand" });
    await addMembers(page, url, ["Ali", "Sara", "مریم خان"]);

    await page.goto(`${url}/turns`);
    await expect(page.getByRole("heading", { name: "Turn order" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save order" })).toBeDisabled();
    expect(await names(page)).toEqual(["Ali", "Sara", "مریم خان"]);

    // The first turn cannot move earlier and the last cannot move later.
    await expect(page.getByRole("button", { name: "Move Ali earlier" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Move مریم خان later" })).toBeDisabled();

    await page.getByRole("button", { name: "Move مریم خان earlier" }).click();
    await page.getByRole("button", { name: "Move مریم خان earlier" }).click();
    expect(await names(page)).toEqual(["مریم خان", "Ali", "Sara"]);
    await expect(page.getByRole("button", { name: "Save order" })).toBeEnabled();

    // Undo puts it back without saving anything.
    await page.getByRole("button", { name: "Undo changes" }).click();
    expect(await names(page)).toEqual(["Ali", "Sara", "مریم خان"]);

    await page.getByRole("button", { name: "Move Sara earlier" }).click();
    await page.getByLabel("Reason (optional)").fill("Agreed at the meeting");
    await page.getByRole("button", { name: "Save order" }).click();
    await expect(page.getByText("Order saved.")).toBeVisible();

    await page.reload();
    expect(await names(page)).toEqual(["Sara", "Ali", "مریم خان"]);
    await expect(page.getByRole("button", { name: "Save order" })).toBeDisabled();
  });

  test("a committee with turns drawn instead shows the order but no hand editor", async ({ page }) => {
    test.setTimeout(90_000);
    const url = await createCommittee(page, { periods: 2, order: "Draw all turns at the start" });
    await page.goto(`${url}/turns`);
    await expect(page.getByText("Turns are decided by:")).toBeVisible();
    await expect(page.getByRole("form", { name: "Arrange the turns" })).toHaveCount(0);
  });

  test("the turns page fits a 375 px phone without sideways scrolling", async ({ page }) => {
    test.setTimeout(120_000);
    const url = await createCommittee(page, { periods: 2, order: "Set the order by hand" });
    await addMembers(page, url, ["Abdul Rehman Muhammad Ibrahim Khan Niazi Sahib Ji", "Sara"]);
    await page.goto(`${url}/turns`);
    await expect(page.getByRole("button", { name: /^Move .* later$/ }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
