import { createHash } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, organiserDb, runningByHand, tokenOf } from "./helpers";
import { makePng } from "./png";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");


/** Ali's payment for the first month, recorded straight in the database, with two small receipt images attached. */
async function committeeWithAlisPayment(page: Page) {
  const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
  const committeeId = url.split("/").pop() as string;
  const db = await organiserDb();
  const holders = await db.from("slot_holders").select("slot_id, members(name), slots!inner(committee_id)").eq("slots.committee_id", committeeId);
  const aliSlot = holders.data!.find((h) => (h.members as unknown as { name: string }).name === "Ali")!.slot_id;
  const paid = await db.rpc("record_payment", { p_committee_id: committeeId, p_slot_id: aliSlot, p_period: 1, p_paid_on: "2026-01-12", p_method: "easypaisa" });
  expect(paid.error).toBeNull();
  const paymentId = paid.data as string;
  const png = makePng(40, 30);
  const sha = createHash("sha256").update(png).digest("hex");
  for (const n of [1, 2]) {
    const path = `${committeeId}/${paymentId}/${n}.png`;
    expect((await db.storage.from("receipts").upload(path, png, { contentType: "image/png" })).error).toBeNull();
    const attached = await db.rpc("attach_receipt", { p_committee_id: committeeId, p_payment_id: paymentId, p_slot_no: n, p_storage_path: path, p_sha256: sha, p_mime: "image/png", p_size_bytes: png.length });
    expect(attached.error).toBeNull();
  }
  await page.goto(`${url}/members`);
  return { url, paymentId, ali: await tokenOf(page, "Ali"), sara: await tokenOf(page, "مریم خان") };
}

test.describe("a member sees their own payments and receipts (US-20)", () => {
  test("my payments with my receipts, and nothing of anyone else's (FR-18)", async ({ page, browser }, testInfo) => {
    test.setTimeout(400_000);
    const { paymentId, ali, sara } = await committeeWithAlisPayment(page);
    const stranger = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
    const view = await stranger.newPage();

    await view.goto(`/m/${ali}`);
    const mine = view.getByRole("region", { name: "Your payments" });
    await expect(mine).toContainText("Jan 2026");
    await expect(mine).toContainText("Rs 1,000");
    await expect(mine).toContainText("Paid 12 Jan 2026 · Easypaisa");
    await expect(mine.getByRole("link", { name: "Open receipt 1 for Jan 2026" })).toBeVisible();
    await expect(mine.getByRole("link", { name: "Open receipt 2 for Jan 2026" })).toBeVisible();
    await expect(mine.getByRole("link", { name: /Open receipt 1 for/ })).toHaveAttribute("rel", /noopener/);

    // Sara has paid nothing, sees none of Ali's payment, and cannot open Ali's receipts with her own link.
    await view.goto(`/m/${sara}`);
    await expect(view.getByRole("region", { name: "Your payments" })).toContainText("No payments are recorded for you yet.");
    await expect(view.locator("main")).not.toContainText("Easypaisa");
    const others = await stranger.request.get(`/m/${sara}/receipt/${paymentId}/1`, { maxRedirects: 0 });
    expect(others.status()).toBe(404);

    // Ali's own receipt opens through a short-lived link, or says plainly that opening is not set up on this server.
    const open = await stranger.request.get(`/m/${ali}/receipt/${paymentId}/1`, { maxRedirects: 0 });
    expect([302, 503]).toContain(open.status());
    if (open.status() === 302) expect(open.headers()["location"]).toMatch(/\/object\/sign\/receipts\/.*token=/);
    else expect((await open.json()).error).toMatch(/can't be opened right now/);

    // A made-up payment, a third receipt, and a wrong link all look the same: not found.
    expect((await stranger.request.get(`/m/${ali}/receipt/00000000-0000-0000-0000-000000000000/1`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await stranger.request.get(`/m/${ali}/receipt/${paymentId}/3`, { maxRedirects: 0 })).status()).toBe(404);
    expect((await stranger.request.get(`/m/${"A".repeat(43)}/receipt/${paymentId}/1`, { maxRedirects: 0 })).status()).toBe(404);
    await stranger.close();
  });

  test("the payments list fits a phone, with Urdu-script names", async ({ page, browser }, testInfo) => {
    test.setTimeout(400_000);
    const { ali } = await committeeWithAlisPayment(page);
    const stranger = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
    const view = await stranger.newPage();
    await view.goto(`/m/${ali}`);
    await expect(view.getByRole("region", { name: "Your payments" })).toBeVisible();
    expect(await view.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await stranger.close();
  });
});
