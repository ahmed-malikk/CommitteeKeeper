import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, hasLogin } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** Makes a small committee through the guided flow and opens its Members page. */
async function committeeWithPeriods(page: Page, periods: number) {
  await page.goto("/committees/new");
  await page.getByLabel("Committee name").fill(`Members test ${Date.now()}`);
  await page.getByLabel("Instalment (Rs per period)").fill("1000");
  await page.getByLabel("Number of periods (2 to 30)").fill(String(periods));
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create committee" }).click();
  await expect(page).toHaveURL(/\?created=1$/, { timeout: 15_000 });
  await page.getByRole("link", { name: "Members", exact: true }).click();
  await expect(page).toHaveURL(/\/members$/);
}

async function addMember(page: Page, name: string, slots: string, contact?: { email?: string; phone?: string }) {
  const form = page.getByRole("form", { name: "Add a member" });
  await form.getByLabel("Name").fill(name);
  if (contact?.email) await form.getByLabel("Email (optional)").fill(contact.email);
  if (contact?.phone) await form.getByLabel("Phone (optional)").fill(contact.phone);
  await form.getByLabel("Slots").fill(slots);
  await form.getByRole("button", { name: "Add member" }).click();
}

test.describe("members and slots", () => {
  test("a member can hold several slots, and the pot follows the number of slots (TC-007)", async ({ page }) => {
    test.setTimeout(90_000);
    await committeeWithPeriods(page, 3);
    await expect(page.getByText("0 of 3 slots given out. 3 more slots are needed")).toBeVisible();

    await addMember(page, "Ali", "2", { email: "ali@example.com", phone: "0300 1234567" });
    await expect(page.getByText("2 slots · owes Rs 2,000 each period")).toBeVisible();
    await expect(page.getByText("ali@example.com · 0300 1234567")).toBeVisible();
    await expect(page.getByText("2 of 3 slots given out. 1 more slot is needed")).toBeVisible();

    await addMember(page, "مریم خان", "1");
    await expect(page.getByText("3 slots for 3 periods. The pot is Rs 3,000 each period.")).toBeVisible();
    await expect(page.getByText("مریم خان")).toBeVisible();
    await expect(page.getByLabel("More slots for Ali")).toBeDisabled();
  });

  test("each bad answer gets its own message, and a full committee refuses more slots", async ({ page }) => {
    test.setTimeout(90_000);
    await committeeWithPeriods(page, 2);
    const form = page.getByRole("form", { name: "Add a member" });
    await form.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("Enter the member's name.")).toBeVisible();

    await addMember(page, "Bilal", "5", { email: "nope", phone: "abc" });
    await expect(page.getByText("Only 2 slots are left in this committee.")).toBeVisible();
    await expect(page.getByText(/email address doesn't look right/)).toBeVisible();
    await expect(page.getByText(/Use digits only/)).toBeVisible();
  });

  test("a typo can be corrected, slots can be taken away, and a member with no slot can be removed", async ({ page }) => {
    test.setTimeout(90_000);
    await committeeWithPeriods(page, 3);
    await addMember(page, "Hasan", "1");
    await expect(page.getByText("1 slot · owes Rs 1,000 each period")).toBeVisible();

    await page.getByText("Edit details").click();
    await page.getByRole("form", { name: "Edit Hasan" }).getByLabel("Name").fill("Hassan");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Hassan", { exact: true })).toBeVisible();

    // A member who still holds a slot cannot be removed; take the slot away first.
    await page.getByText("Edit details").click();
    await expect(page.getByRole("button", { name: "Remove member" })).toBeDisabled();
    await page.getByLabel("Fewer slots for Hassan").click();
    await expect(page.getByText("No slot yet")).toBeVisible();
    await page.getByRole("button", { name: "Remove member" }).click();
    await expect(page.getByText("No members yet.")).toBeVisible();
  });

  test("a long Urdu-script name fits at any width", async ({ page }) => {
    test.setTimeout(90_000);
    await committeeWithPeriods(page, 3);
    await addMember(page, "محمد عبدالرحمن بن عبداللہ الطویل نام والا آدمی", "1", { email: "a-very-long-address-for-testing@example-domain.com" });
    await expect(page.getByText("محمد عبدالرحمن")).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(wide).toBe(false);
  });
});
