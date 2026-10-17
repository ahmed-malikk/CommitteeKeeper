import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, hasLogin } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** Makes a committee through the guided flow. `order` is the label of the turn-order choice. */
async function createCommittee(page: Page, o: { periods: number; order: string; startDate?: string }) {
  await page.goto("/committees/new");
  await page.getByLabel("Committee name").fill(`Start test ${Date.now()}`);
  await page.getByLabel("Instalment (Rs per period)").fill("1000");
  await page.getByLabel("Number of periods (2 to 30)").fill(String(o.periods));
  if (o.startDate) await page.getByLabel("Start date").fill(o.startDate);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("region", { name: "Turn order" }).getByText(o.order, { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create committee" }).click();
  await expect(page).toHaveURL(/\?created=1$/, { timeout: 15_000 });
  return page.url().split("?")[0];
}

async function addMemberWithSlot(page: Page, name: string) {
  const form = page.getByRole("form", { name: "Add a member" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Slots").fill("1");
  await form.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

test.describe("starting a committee", () => {
  test("every problem is listed together and the button stays off (TC-018)", async ({ page }) => {
    test.setTimeout(90_000);
    await createCommittee(page, { periods: 3, order: "Draw all turns at the start" });
    await expect(page.getByText("Can’t start yet:")).toBeVisible();
    await expect(page.getByText("Add at least 2 slots")).toBeVisible();
    await expect(page.getByText("The number of slots (0) must equal the number of periods (3)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start committee" })).toBeDisabled();
  });

  test("a full committee still needs its turn order when turns are set by hand", async ({ page }) => {
    test.setTimeout(90_000);
    const url = await createCommittee(page, { periods: 2, order: "Set the order by hand" });
    await page.goto(`${url}/members`);
    await addMemberWithSlot(page, "Ali");
    await addMemberWithSlot(page, "Sara");
    await page.goto(url);
    await expect(page.getByText("Set the turn order first (by hand or by the start draw)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Start committee" })).toBeDisabled();
  });

  test("a committee that began months ago starts as already running, and is then locked (TC-008)", async ({ page }) => {
    test.setTimeout(120_000);
    const url = await createCommittee(page, { periods: 2, order: "Draw each month", startDate: "2026-01-15" });
    await page.goto(`${url}/members`);
    await addMemberWithSlot(page, "Ali");
    await addMemberWithSlot(page, "Sara");
    await page.goto(url);
    await expect(page.getByText("This committee began on")).toBeVisible();
    await page.getByRole("button", { name: "Start committee" }).click();
    await expect(page.getByText("Start this committee?")).toBeVisible();
    await page.getByRole("button", { name: "Yes, start it" }).click();

    await expect(page.getByText("This committee is running.")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".head .chip")).toHaveText("Running");
    await expect(page.getByRole("button", { name: "Start committee" })).toHaveCount(0);

    // Once running, slots cannot be changed any more.
    await page.getByRole("link", { name: "Members", exact: true }).click();
    await expect(page.getByLabel("More slots for Ali")).toHaveCount(0);
    await expect(page.getByText("2 slots. The pot is Rs 2,000 each period.")).toBeVisible();
  });
});
