import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, organiserDb, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** Today in Pakistan (UTC+5), as the app counts it. */
const pakistanDay = (plus = 0) => new Date(Date.now() + 5 * 3_600_000 + plus * 86_400_000).toISOString().slice(0, 10);

// Two members, two periods, Rs 1,000 a month: each pot is Rs 2,000. The turn order is مریم خان first, then Ali.
test.describe("recording a payout (US-12)", () => {
  test("pick a turn, see who gets what, confirm; the turn is locked and cannot be paid out twice (FR-12, TC-038)", async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/turns`);

    const form = page.getByRole("form", { name: "Record a payout" });
    await expect(form.locator("#payout-slot option")).toHaveCount(2);
    await expect(form.locator("#payout-slot option:checked")).toContainText("Turn 1");
    await expect(form.getByText("The pot is Rs 2,000.")).toBeVisible();
    await expect(form.getByText(/receives\s*Rs 2,000/)).toBeVisible();

    await form.getByRole("button", { name: "Record payout" }).click();
    const confirm = page.getByRole("group", { name: "Confirm payout" });
    await expect(confirm).toBeFocused();
    // "Not yet" backs out without recording anything.
    await confirm.getByRole("button", { name: "Not yet" }).click();
    await expect(page.getByRole("group", { name: "Confirm payout" })).toHaveCount(0);
    await expect(form.getByRole("button", { name: "Record payout" })).toBeFocused();

    await form.getByRole("button", { name: "Record payout" }).click();
    await page.getByRole("button", { name: "Yes, record it" }).click();
    await expect(page.getByText("Payout recorded. The turn is locked.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Paid out").first()).toBeVisible();
    // Only the other turn can still be paid out.
    await expect(page.getByRole("form", { name: "Record a payout" }).locator("#payout-slot option")).toHaveCount(1);

    // The database refuses a second payout for the same turn, even when asked directly.
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const paid = await db.from("slots").select("id").eq("committee_id", committeeId).eq("paid_out", true);
    expect(paid.data).toHaveLength(1);
    const again = await db.rpc("record_payout", { p_committee_id: committeeId, p_slot_id: paid.data![0].id, p_paid_on: pakistanDay(), p_split: [] });
    expect(again.error).not.toBeNull();
    // A split that does not add up to the pot, or names someone who never held the slot, is refused too.
    const open = await db.from("slots").select("id").eq("committee_id", committeeId).eq("paid_out", false);
    const wrong = await db.rpc("record_payout", {
      p_committee_id: committeeId,
      p_slot_id: open.data![0].id,
      p_paid_on: pakistanDay(),
      p_split: [{ member_id: "00000000-0000-0000-0000-000000000000", amount: 2000 }],
    });
    expect(wrong.error).not.toBeNull();
  });

  test("a payout date in the future is refused by the server (FR-12)", async ({ page }) => {
    test.setTimeout(240_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const slot = await db.from("slots").select("id").eq("committee_id", committeeId).limit(1).single();
    const holder = await db.from("slot_holders").select("member_id").eq("slot_id", slot.data!.id).single();
    const future = await db.rpc("record_payout", {
      p_committee_id: committeeId,
      p_slot_id: slot.data!.id,
      p_paid_on: pakistanDay(3),
      p_split: [{ member_id: holder.data!.member_id, amount: 2000 }],
    });
    expect(future.error?.message).toMatch(/future/);
  });

  test("the payout form fits the width, with Urdu-script names", async ({ page }) => {
    test.setTimeout(240_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/turns`);
    await expect(page.getByRole("form", { name: "Record a payout" }).locator(".payout-split").getByText("مریم خان")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
