import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, addMembers, createCommittee, hasLogin, runningByHand, startCommitteeOnPage } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** While the committee runs, a new member has no slot yet (slots are only given out while forming). */
async function addMemberWithoutSlot(page: Page, name: string) {
  const form = page.getByRole("form", { name: "Add a member" });
  await form.getByLabel("Name").fill(name);
  await form.getByRole("button", { name: "Add member" }).click();
  await expect(page.locator(".members .t", { hasText: name })).toBeVisible();
}

test.describe("a member leaves and a replacement takes over", () => {
  test("the new holder takes the slot from a later period and the pot splits by periods covered (FR-11)", async ({ page }) => {
    test.setTimeout(240_000);
    // Rs 1,000 and 4 periods: Ali covers period 1, Noor takes over from period 2, so the pot splits Rs 1,000 and Rs 3,000.
    const { url } = await runningByHand(page, ["Ali", "Sara", "Hira", "Bilal"]);
    await page.goto(`${url}/members`);
    await addMemberWithoutSlot(page, "Noor");

    const form = page.getByRole("form", { name: "A member leaves" });
    await expect(form.getByRole("button", { name: "Hand the slot over" })).toBeDisabled();
    await form.getByLabel("Slot that changes hands").selectOption({ label: "Ali" });
    // The leaver cannot be chosen as their own replacement.
    await expect(form.getByLabel("Replacement").getByRole("option", { name: "Ali" })).toHaveCount(0);
    await form.getByLabel("Replacement").selectOption({ label: "Noor" });
    // The leaver already holds period 1, so the earliest period offered is 2.
    await expect(form.getByLabel("Takes over from period").getByRole("option", { name: "Period 1" })).toHaveCount(0);
    await form.getByLabel("Takes over from period").selectOption({ label: "Period 2" });

    await expect(form.getByText("Ali: Rs 1,000")).toBeVisible();
    await expect(form.getByText("Noor: Rs 3,000")).toBeVisible();
    await form.getByLabel("Reason (optional)").fill("Moved abroad");
    await form.getByRole("button", { name: "Hand the slot over" }).click();

    await expect(page.getByText("Done. The new holder is in the history")).toBeVisible();
    await expect(page.getByText("No slot now · covered earlier periods of a slot")).toBeVisible();
    await expect(page.getByText("1 slot · owes Rs 1,000 each period").first()).toBeVisible();

    await page.getByRole("link", { name: "Turns", exact: true }).click();
    await expect(page.locator(".turns .li .t", { hasText: "Ali (period 1), Noor (2 to 4)" })).toBeVisible();
    await expect(page.getByText("Pot split: Ali Rs 1,000 · Noor Rs 3,000")).toBeVisible();
  });

  test("a member with two slots hands over only one of them", async ({ page }) => {
    test.setTimeout(240_000);
    const url = await createCommittee(page, { periods: 3, order: "Set the order by hand", startDate: "2026-01-15" });
    await page.goto(`${url}/members`);
    const add = page.getByRole("form", { name: "Add a member" });
    await add.getByLabel("Name").fill("Ali");
    await add.getByLabel("Slots").fill("2");
    await add.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("2 slots · owes Rs 2,000 each period")).toBeVisible();
    await addMembers(page, url, ["Sara"]);

    await page.goto(`${url}/turns`);
    await page.getByRole("button", { name: "Move Ali later" }).first().click();
    await page.getByRole("button", { name: "Save order" }).click();
    await expect(page.getByText("Order saved.")).toBeVisible();
    await startCommitteeOnPage(page, url);

    await page.goto(`${url}/members`);
    await addMemberWithoutSlot(page, "Noor");
    const form = page.getByRole("form", { name: "A member leaves" });
    await form.getByLabel("Slot that changes hands").selectOption({ label: "Ali · slot 2" });
    await form.getByLabel("Replacement").selectOption({ label: "Noor" });
    await form.getByLabel("Takes over from period").selectOption({ label: "Period 2" });
    await form.getByRole("button", { name: "Hand the slot over" }).click();
    await expect(page.getByText("Done. The new holder is in the history")).toBeVisible();

    // Ali still holds his other slot; Noor now holds one. The pot is unchanged.
    await expect(page.getByText("3 slots. The pot is Rs 3,000 each period.")).toBeVisible();
    await expect(page.getByText("1 slot · owes Rs 1,000 each period · covered earlier periods of another slot")).toBeVisible();
    await expect(page.getByText("2 slots · owes Rs 2,000 each period")).toHaveCount(0);
  });

  test("there is no leaver form while the committee is still forming", async ({ page }) => {
    test.setTimeout(120_000);
    const url = await createCommittee(page, { periods: 2, order: "Set the order by hand" });
    await addMembers(page, url, ["Ali", "Sara"]);
    await page.goto(`${url}/members`);
    await expect(page.getByRole("form", { name: "A member leaves" })).toHaveCount(0);
  });
});
