import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, organiserDb, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** Today in Pakistan plus a number of days, as the app counts it. */
const pakistanDay = (plus = 0) => new Date(Date.now() + 5 * 3_600_000 + plus * 86_400_000).toISOString().slice(0, 10);

/** A running committee that began in January 2026 with two periods (January and February), so both are due. */
async function running(page: Page) {
  const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
  await page.goto(`${url}/payments`);
  return url;
}

test.describe("recording a payment (US-7)", () => {
  test("record the full instalment from a row, and the row shows it paid (FR-7)", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    const url = await running(page);
    await expect(page.getByRole("heading", { name: /Feb 2026/ })).toBeVisible();
    await expect(page.getByText("0 of 2")).toBeVisible();

    // The clock for the "under 20 seconds on a phone" criterion starts when the organiser taps Record.
    const started = Date.now();
    await page.getByRole("link", { name: "Record a payment for Ali", exact: true }).click();
    const form = page.getByRole("form", { name: "Record a payment" });
    await expect(form.getByLabel("Slot")).toHaveValue(/.+/);
    await expect(page).toHaveURL(/slot=/);
    await expect(form.locator("#pay-slot option:checked")).toHaveText("Ali");
    // The amount is shown, never typed: there is no amount field.
    await expect(form.getByText("the full instalment, Rs 1,000")).toBeVisible();
    await expect(form.getByLabel(/amount/i)).toHaveCount(0);
    await form.getByText("Easypaisa", { exact: true }).click();
    await form.getByLabel(/Note/).fill("TX 12345");
    await form.getByRole("button", { name: "Save payment" }).click();
    await expect(page.getByText("Saved. It is in the history.")).toBeVisible({ timeout: 15_000 });
    const seconds = (Date.now() - started) / 1000;
    testInfo.annotations.push({ type: "record-a-payment seconds", description: seconds.toFixed(1) });
    console.log(`[${testInfo.project.name}] record a payment took ${seconds.toFixed(1)} s from the tap on Record`);
    expect(seconds).toBeLessThan(20);

    await expect(page.getByText("1 of 2")).toBeVisible();
    await expect(page.getByText(/Paid .* Easypaisa/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Record a payment for Ali", exact: true })).toHaveCount(0);
    // The private note is never shown on the list.
    await expect(page.getByText("TX 12345")).toHaveCount(0);
    expect(url).toContain("/committees/");
  });

  test("a second payment for the same slot and month is refused with the reason (FR-7, TC-024)", async ({ page }) => {
    test.setTimeout(240_000);
    const url = await running(page);
    await page.getByRole("link", { name: "Record a payment for Ali", exact: true }).click();
    const form = page.getByRole("form", { name: "Record a payment" });
    await expect(form.locator("#pay-slot option:checked")).toHaveText("Ali");
    await form.getByRole("button", { name: "Save payment" }).click();
    await expect(page.getByText("Saved. It is in the history.")).toBeVisible({ timeout: 15_000 });

    // The form says so before anything is sent...
    await form.getByLabel("Slot").selectOption({ label: "Ali" });
    await expect(form.getByText("A payment is already recorded for this slot in Feb 2026")).toBeVisible();
    await expect(form.getByRole("button", { name: "Save payment" })).toBeDisabled();

    // ...and the database refuses it too, whatever the browser does.
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const slot = (await db.from("slots").select("id").eq("committee_id", committeeId).order("created_at")).data?.[0];
    const again = await db.rpc("record_payment", { p_committee_id: committeeId, p_slot_id: slot?.id, p_period: 2, p_paid_on: pakistanDay(), p_method: "cash" });
    expect(again.error?.message).toMatch(/already recorded/);
  });

  test("a date in the future is refused, in the form and in the database (FR-7)", async ({ page }) => {
    test.setTimeout(240_000);
    const url = await running(page);
    await page.getByRole("link", { name: "Record a payment for Ali", exact: true }).click();
    const form = page.getByRole("form", { name: "Record a payment" });
    await expect(form.locator("#pay-slot option:checked")).toHaveText("Ali");
    await form.getByLabel("Date paid").fill(pakistanDay(1));
    await form.getByRole("button", { name: "Save payment" }).click();
    await expect(form.getByText(/can.t be in the future/)).toBeVisible();
    await expect(form.getByLabel("Date paid")).toHaveValue(pakistanDay(1)); // what was typed is kept
    await expect(page.getByText("0 of 2")).toBeVisible();

    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const slot = (await db.from("slots").select("id").eq("committee_id", committeeId).order("created_at")).data?.[0];
    const future = await db.rpc("record_payment", { p_committee_id: committeeId, p_slot_id: slot?.id, p_period: 2, p_paid_on: pakistanDay(1), p_method: "cash" });
    expect(future.error?.message).toMatch(/future/);
  });

  test("an earlier date is accepted (backdating) and the month can be changed", async ({ page }) => {
    test.setTimeout(240_000);
    await running(page);
    await page.getByRole("link", { name: "Earlier month, Jan 2026" }).click();
    await expect(page.getByRole("heading", { name: /Jan 2026/ })).toBeVisible();
    await page.getByRole("link", { name: "Record a payment for مریم خان", exact: true }).click();
    const form = page.getByRole("form", { name: "Record a payment" });
    await expect(form.locator("#pay-slot option:checked")).toHaveText("مریم خان");
    await form.getByLabel("Date paid").fill("2026-01-12");
    await form.getByText("Cash", { exact: true }).click();
    await form.getByRole("button", { name: "Save payment" }).click();
    await expect(page.getByText("Saved. It is in the history.")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Paid 12 Jan 2026 · Cash/)).toBeVisible();
  });

  test("the payments screen fits the width, with Urdu-script names", async ({ page }) => {
    test.setTimeout(240_000);
    await running(page);
    await expect(page.getByText("مریم خان").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("a committee that has not started has no payments yet", async ({ page }) => {
    test.setTimeout(120_000);
    const { createCommittee } = await import("./helpers");
    const url = await createCommittee(page, { periods: 2, order: "Draw each month" });
    await page.goto(`${url}/payments`);
    await expect(page.getByRole("heading", { name: "This committee has not started" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Record a payment" })).toHaveCount(0);
  });
});
