import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, organiserDb, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** A running committee (January 2026, two periods) where Ali's payment for the first month is already recorded. */
async function withPaymentFor(page: Page, name: string) {
  const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
  await page.goto(`${url}/payments?period=1`);
  await page.getByRole("link", { name: `Record a payment for ${name}`, exact: true }).click();
  const form = page.getByRole("form", { name: "Record a payment" });
  // Wait for the form to switch to that slot before typing, or the payment could go to the first slot.
  await expect(form.locator("#pay-slot option:checked")).toHaveText(name);
  await form.getByLabel("Date paid").fill("2026-01-12");
  await form.getByText("Cash", { exact: true }).click();
  await form.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByText("Saved. It is in the history.")).toBeVisible({ timeout: 15_000 });
  return url;
}

test.describe("correcting a payment (US-13)", () => {
  test("a correction is a new entry that points to the original; both stay (FR-13, TC-040)", { tag: "@smoke" }, async ({ page }) => {
    test.setTimeout(300_000);
    const url = await withPaymentFor(page, "Ali");
    const row = page.locator(".li", { hasText: "Paid 12 Jan 2026" });
    await row.getByRole("button", { name: /Correct or cancel/ }).click();
    const fix = page.getByRole("form", { name: "Correct the payment of Ali" });

    // The reason is required, and the form says so without sending anything.
    await fix.getByLabel("Date paid").fill("2026-01-14");
    await fix.getByLabel("Method").selectOption("bank");
    await fix.getByRole("button", { name: "Save the correction" }).click();
    await expect(fix.getByText("Say what was wrong. It is written to the history.")).toBeVisible();

    await fix.getByLabel("What was wrong?").fill("Typed the wrong day and method");
    await fix.getByRole("button", { name: "Save the correction" }).click();
    await expect(page.getByText(/Paid 14 Jan 2026 · Bank deposit/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Paid 12 Jan 2026")).toHaveCount(0);

    // In the database: the original entry is untouched, and the new one points to it.
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const events = await db.from("ledger_events").select("id, seq, type, corrects_event_id, payload").eq("committee_id", committeeId).in("type", ["payment_recorded", "payment_corrected"]).order("seq");
    expect(events.data?.map((e) => e.type)).toEqual(["payment_recorded", "payment_corrected"]);
    expect(events.data![1].corrects_event_id).toBe(events.data![0].id);
    expect(events.data![1].payload.reason).toBe("Typed the wrong day and method");
  });

  test("a payment can be cancelled the same way, and the instalment is unpaid again (FR-13)", async ({ page }) => {
    test.setTimeout(300_000);
    const url = await withPaymentFor(page, "Ali");
    await expect(page.locator(".sentence")).toContainText("1 of 2");
    await page.getByRole("button", { name: /Correct or cancel/ }).click();
    const fix = page.getByRole("form", { name: "Correct the payment of Ali" });
    await fix.getByLabel(/Cancel this payment instead/).check();
    await fix.getByRole("button", { name: "Cancel the payment" }).click();
    await expect(fix.getByText("Say why this payment is being cancelled. It is written to the history.")).toBeVisible();
    await fix.getByLabel("Why is it being cancelled?").fill("Recorded against the wrong member");
    await fix.getByRole("button", { name: "Cancel the payment" }).click();
    await expect(page.locator(".sentence")).toContainText("0 of 2", { timeout: 15_000 });
    // It can be recorded again, since the cancelled one no longer counts.
    await expect(page.getByRole("link", { name: "Record a payment for Ali", exact: true })).toBeVisible();

    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const events = await db.from("ledger_events").select("type, payload").eq("committee_id", committeeId).eq("type", "payment_corrected");
    expect(events.data).toHaveLength(1);
    expect(events.data![0].payload.cancelled).toBe(true);
  });

  test("the history refuses UPDATE and DELETE, even for the organiser's own session (FR-13, TC-039)", async ({ page }) => {
    test.setTimeout(240_000);
    const url = await withPaymentFor(page, "Ali");
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const before = await db.from("ledger_events").select("id, type").eq("committee_id", committeeId).order("seq");
    expect(before.data!.length).toBeGreaterThan(0);

    const changed = await db.from("ledger_events").update({ type: "committee_created" }).eq("committee_id", committeeId).select();
    expect(changed.error !== null || (changed.data ?? []).length === 0).toBe(true);
    const removed = await db.from("ledger_events").delete().eq("committee_id", committeeId).select();
    expect(removed.error !== null || (removed.data ?? []).length === 0).toBe(true);

    const after = await db.from("ledger_events").select("id, type").eq("committee_id", committeeId).order("seq");
    expect(after.data).toEqual(before.data);
  });

  test("the correction form fits a phone and works with a long Urdu-script reason", async ({ page }) => {
    test.setTimeout(300_000);
    await withPaymentFor(page, "Ali");
    await page.getByRole("button", { name: /Correct or cancel/ }).click();
    const fix = page.getByRole("form", { name: "Correct the payment of Ali" });
    await fix.getByLabel("What was wrong?").fill("غلط تاریخ لکھی گئی تھی اور غلط طریقہ منتخب ہوا");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
