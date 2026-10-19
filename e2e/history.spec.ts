import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, organiserDb, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

test.describe("the history and its chain check (US-14)", () => {
  test("every entry shows its number, who, when, details and fingerprint; a correction points to its original; the chain is intact (FR-13, TC-042)", { tag: "@smoke" }, async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);

    // One payment, then a correction of it.
    await page.goto(`${url}/payments?period=1`);
    await page.getByRole("link", { name: "Record a payment for Ali", exact: true }).first().click();
    const form = page.getByRole("form", { name: "Record a payment" });
    await expect(form.locator("#pay-slot option:checked")).toHaveText("Ali");
    await form.getByLabel("Date paid").fill("2026-01-12");
    await form.getByRole("button", { name: "Save payment" }).click();
    await expect(page.getByText("Saved. It is in the history.")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Correct or cancel/ }).click();
    const fix = page.getByRole("form", { name: "Correct the payment of Ali" });
    await fix.getByLabel("Date paid").fill("2026-01-13");
    await fix.getByLabel("What was wrong?").fill("Typed the wrong day");
    await fix.getByRole("button", { name: "Save the correction" }).click();
    await expect(page.getByText(/Paid 13 Jan 2026/)).toBeVisible({ timeout: 15_000 });

    await page.goto(`${url}/history`);
    await expect(page.getByRole("heading", { name: "Is the history intact?" })).toBeVisible();
    await expect(page.getByText(/Intact\. Every entry is present, in order, and matches its fingerprint\./)).toBeVisible();

    const list = page.getByRole("list", { name: /Everything that happened/ });
    const corrected = list.locator("li", { hasText: "Payment corrected" });
    await expect(corrected).toContainText("Reason: Typed the wrong day");
    await expect(corrected).toContainText(/Corrects entry #\d+/);
    await expect(corrected).toContainText(/Happened 13 Jan 2026 · recorded .* · by You/);
    await expect(corrected).toContainText("Fingerprint");
    // The original is still there, unchanged, and the entry numbers run without gaps.
    const original = list.locator("li", { hasText: "Payment recorded" });
    await expect(original).toContainText("Happened 12 Jan 2026");
    const numbers = await list.locator(".no").allTextContents();
    const ordered = numbers.map((n) => Number(n.replace("#", "")));
    expect(ordered[0]).toBeGreaterThan(ordered[ordered.length - 1]); // newest first
    expect([...ordered].sort((a, b) => a - b)).toEqual(Array.from({ length: ordered.length }, (_, i) => i + 1));
    // The first entry of every committee is its creation.
    await expect(list.locator("li").last()).toContainText("Committee created");

    // The database's own answer agrees with the page.
    const db = await organiserDb();
    const checked = await db.rpc("verify_chain", { p_committee_id: url.split("/").pop() as string });
    expect(checked.data).toBe("ok");
  });

  test("it prints as a document: no navigation, the chain result and the entries stay (FR-13)", async ({ page }) => {
    test.setTimeout(240_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/history`);
    await expect(page.getByRole("heading", { name: "Is the history intact?" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("navigation", { name: "This committee" })).toBeHidden();
    await expect(page.getByRole("button", { name: /Print or save as PDF/ })).toBeHidden();
    await expect(page.getByText(/Intact\./)).toBeVisible();
    await expect(page.getByText("Committee started")).toBeVisible();
  });

  test("the history fits the width, with Urdu-script names", async ({ page }) => {
    test.setTimeout(240_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/history`);
    await expect(page.getByText(/مریم خان/).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
