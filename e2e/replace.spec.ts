import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, runningByHand, seedCommittee } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

test.describe("a member leaves and a replacement takes over", () => {
  test("the new holder takes the slot from a later period and the pot splits by periods covered (FR-11)", async ({ page }) => {
    test.setTimeout(240_000);
    // Rs 1,000 and 4 periods: Ali covers period 1, Noor takes over from period 2, so the pot splits Rs 1,000 and Rs 3,000.
    const { url } = await runningByHand(page, ["Ali", "Sara", "Hira", "Bilal"]);
    await page.goto(`${url}/members`);

    // Every slot is taken, so there is no way to add a member on their own: someone new joins only by taking over a slot.
    await expect(page.getByRole("form", { name: "Add a member" })).toHaveCount(0);
    await expect(page.getByText("nobody new can join on their own")).toBeVisible();

    const form = page.getByRole("form", { name: "A member leaves" });
    await expect(form.getByRole("button", { name: "Hand the slot over" })).toBeDisabled();
    await form.getByLabel("Slot that changes hands").selectOption({ label: "Ali" });
    // The leaver cannot be chosen as their own replacement.
    await expect(form.getByLabel("Replacement").getByRole("option", { name: "Ali" })).toHaveCount(0);
    await form.getByLabel("Replacement").selectOption({ label: "A new person…" });
    await form.getByLabel("New person’s name").fill("Noor");
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
    // Ali holds two slots and Sara one, so 3 periods; Ali's turns are moved later, then it starts.
    const { url } = await seedCommittee({ names: ["Ali", "Sara"], slots: [2, 1], method: "hand", periods: 3, start: true, moveFirstLater: true });
    await page.goto(`${url}/members`);
    await expect(page.getByText("2 slots · owes Rs 2,000 each period")).toBeVisible();
    const form = page.getByRole("form", { name: "A member leaves" });
    await form.getByLabel("Slot that changes hands").selectOption({ label: "Ali · slot 2" });
    await form.getByLabel("Replacement").selectOption({ label: "A new person…" });
    await form.getByLabel("New person’s name").fill("Noor");
    await form.getByLabel("Takes over from period").selectOption({ label: "Period 2" });
    await form.getByRole("button", { name: "Hand the slot over" }).click();
    await expect(page.getByText("Done. The new holder is in the history")).toBeVisible();

    // Ali still holds his other slot; Noor now holds one. The pot is unchanged.
    await expect(page.getByText("3 slots. The pot is Rs 3,000 each period.")).toBeVisible();
    await expect(page.getByText("1 slot · owes Rs 1,000 each period · covered earlier periods of another slot")).toBeVisible();
    await expect(page.getByText("2 slots · owes Rs 2,000 each period")).toHaveCount(0);
  });

  test("someone already in the committee can take over a slot, and a nameless new person is refused (FR-11)", async ({ page }) => {
    test.setTimeout(240_000);
    const { url } = await runningByHand(page, ["Ali", "Sara", "Hira"]);
    await page.goto(`${url}/members`);
    const form = page.getByRole("form", { name: "A member leaves" });
    await form.getByLabel("Slot that changes hands").selectOption({ label: "Ali" });
    // A new person needs a name before the slot can be handed over.
    await form.getByLabel("Replacement").selectOption({ label: "A new person…" });
    await expect(form.getByRole("button", { name: "Hand the slot over" })).toBeDisabled();
    // Someone who is already a member can take over instead (they then hold two slots).
    await form.getByLabel("Replacement").selectOption({ label: "Sara" });
    await form.getByLabel("Takes over from period").selectOption({ label: "Period 2" });
    await form.getByRole("button", { name: "Hand the slot over" }).click();
    await expect(page.getByText("Done. The new holder is in the history")).toBeVisible();
    await expect(page.getByText("2 slots · owes Rs 2,000 each period")).toBeVisible();
  });

  test("there is no leaver form while the committee is still forming", async ({ page }) => {
    test.setTimeout(120_000);
    const { url } = await seedCommittee({ names: ["Ali", "Sara"], method: "hand", periods: 2 });
    await page.goto(`${url}/members`);
    await expect(page.getByRole("form", { name: "A member leaves" })).toHaveCount(0);
  });
});
