import { expect, test } from "@playwright/test";
import { EMPTY_STATE, ORGANISER_STATE, hasLogin, organiserDb, runningByHand } from "./helpers";
import { makePng } from "./png";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

const TWO_MB = 2 * 1024 * 1024;

/** A running committee (January and February 2026) with Ali's payment for February recorded, optionally with an image chosen. */
async function withPayment(page: import("@playwright/test").Page, image?: { name: string; buffer: Buffer }) {
  const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
  await page.goto(`${url}/payments`);
  await page.getByRole("link", { name: "Record a payment for Ali", exact: true }).click();
  const form = page.getByRole("form", { name: "Record a payment" });
  await expect(form.locator("#pay-slot option:checked")).toHaveText("Ali");
  if (image) await form.getByLabel(/Receipt screenshots/).setInputFiles({ name: image.name, mimeType: "image/png", buffer: image.buffer });
  await form.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByText("Saved. It is in the history.")).toBeVisible({ timeout: 15_000 });
  return { url, committeeId: url.split("/").pop() as string };
}

test.describe("receipt images (US-8)", () => {
  test("attach with the payment, keep a fingerprint in the history, open it privately, then remove it (FR-8, P5)", { tag: "@smoke" }, async ({ page, browser }) => {
    test.setTimeout(300_000);
    const { url, committeeId } = await withPayment(page, { name: "easypaisa-screenshot.png", buffer: makePng(200, 120) });
    await expect(page.getByText("1 receipt attached.")).toBeVisible({ timeout: 30_000 });
    const open = page.getByRole("link", { name: "Open receipt 1 for Ali" });
    await expect(open).toBeVisible({ timeout: 15_000 });

    // Stored as the database says: a small image, a 64-character fingerprint, and the history entry carries the same fingerprint.
    const db = await organiserDb();
    const stored = await db.from("receipts").select("id, mime, size_bytes, sha256, storage_path, removed_at").eq("committee_id", committeeId);
    expect(stored.data).toHaveLength(1);
    const receipt = stored.data![0];
    expect(receipt.size_bytes).toBeLessThanOrEqual(TWO_MB);
    expect(receipt.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(["image/webp", "image/jpeg"]).toContain(receipt.mime);
    const attached = await db.from("ledger_events").select("payload").eq("committee_id", committeeId).eq("type", "receipt_attached");
    expect(attached.data?.[0]?.payload).toMatchObject({ receipt_id: receipt.id, sha256: receipt.sha256 });

    // Opening goes through a short-lived signed link; the bucket is private, so the plain address of the file does not work.
    const link = await page.request.get(`${url}/receipts/${receipt.id}`, { maxRedirects: 0 });
    expect(link.status()).toBe(302);
    expect(link.headers()["location"]).toMatch(/\/object\/sign\/receipts\//);
    expect(link.headers()["location"]).toMatch(/token=/);
    const publicAddress = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/receipts/${receipt.storage_path}`;
    expect((await page.request.get(publicAddress)).ok()).toBe(false);

    // Another organiser, and a signed-out visitor, cannot open it: it looks like it does not exist.
    const other = await browser.newContext({ storageState: EMPTY_STATE });
    expect((await other.request.get(`${url}/receipts/${receipt.id}`, { maxRedirects: 0 })).status()).toBe(404);
    await other.close();
    const signedOut = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const refused = await signedOut.request.get(`${url}/receipts/${receipt.id}`, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(refused.status());
    expect(refused.headers()["location"]).toContain("/sign-in");
    await signedOut.close();

    // Removing asks first, deletes the file, and leaves a history entry with the same fingerprint.
    await page.getByRole("button", { name: "Remove receipt 1 for Ali" }).click();
    await page.getByRole("button", { name: "Remove it" }).click();
    await expect(open).toHaveCount(0, { timeout: 15_000 });
    const after = await db.from("receipts").select("removed_at").eq("id", receipt.id).single();
    expect(after.data?.removed_at).not.toBeNull();
    const removed = await db.from("ledger_events").select("payload").eq("committee_id", committeeId).eq("type", "receipt_removed");
    expect(removed.data?.[0]?.payload).toMatchObject({ receipt_id: receipt.id, sha256: receipt.sha256 });
    const download = await db.storage.from("receipts").download(receipt.storage_path);
    expect(download.error).not.toBeNull();
  });

  test("a big photo is shrunk to 2 MB or less before it is stored, and only 2 fit on one payment (FR-8, TC-025, TC-026)", async ({ page }) => {
    test.setTimeout(300_000);
    const { url, committeeId } = await withPayment(page);
    const row = page.getByRole("link", { name: "Open receipt 1 for Ali" });
    await expect(row).toHaveCount(0);

    // Noise does not compress, so this image is several MB before it is shrunk.
    const big = makePng(1800, 1800, true);
    expect(big.length).toBeGreaterThan(TWO_MB);
    await page.getByLabel("Add a receipt image for Ali").setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: big });
    await expect(page.getByRole("link", { name: "Open receipt 1 for Ali" })).toBeVisible({ timeout: 60_000 });

    await page.getByLabel("Add a receipt image for Ali").setInputFiles({ name: "second.png", mimeType: "image/png", buffer: makePng(120, 80) });
    await expect(page.getByRole("link", { name: "Open receipt 2 for Ali" })).toBeVisible({ timeout: 30_000 });
    // Both places are taken, so there is nothing left to add.
    await expect(page.getByLabel("Add a receipt image for Ali")).toHaveCount(0);

    const db = await organiserDb();
    const stored = await db.from("receipts").select("size_bytes, slot_no").eq("committee_id", committeeId).is("removed_at", null).order("slot_no");
    expect(stored.data).toHaveLength(2);
    for (const r of stored.data ?? []) expect(r.size_bytes).toBeLessThanOrEqual(TWO_MB);

    // The server and the database refuse the rest whatever the browser does.
    const payment = (await db.from("payments_current").select("id").eq("committee_id", committeeId)).data?.[0]?.id as string;
    const third = await page.request.post(`${url}/receipts`, { multipart: { paymentId: payment, file: { name: "third.png", mimeType: "image/png", buffer: makePng(40, 40) } } });
    expect(third.status()).toBe(409);
    expect((await third.json()).error).toMatch(/2 receipts/);
    const tooBig = await page.request.post(`${url}/receipts`, { multipart: { paymentId: payment, file: { name: "huge.png", mimeType: "image/png", buffer: Buffer.concat([makePng(40, 40), Buffer.alloc(TWO_MB + 10)]) } } });
    expect(tooBig.status()).toBe(413);
    const notAnImage = await page.request.post(`${url}/receipts`, { multipart: { paymentId: payment, file: { name: "evil.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") } } });
    expect(notAnImage.status()).toBe(415);
    const direct = await db.rpc("attach_receipt", {
      p_committee_id: committeeId,
      p_payment_id: payment,
      p_slot_no: 1,
      p_storage_path: `${committeeId}/${payment}/1.png`,
      p_sha256: "0".repeat(64),
      p_mime: "image/png",
      p_size_bytes: TWO_MB + 1,
    });
    expect(direct.error).not.toBeNull();
  });

  test("a file that is not an image is explained in the browser and nothing is stored", async ({ page }) => {
    test.setTimeout(300_000);
    const { committeeId } = await withPayment(page);
    await page.getByLabel("Add a receipt image for Ali").setInputFiles({ name: "statement.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 fake") });
    await expect(page.getByText(/Only JPEG, PNG or WebP images can be attached/)).toBeVisible({ timeout: 15_000 });
    const db = await organiserDb();
    const stored = await db.from("receipts").select("id").eq("committee_id", committeeId);
    expect(stored.data).toHaveLength(0);
  });

  test("the payments screen with receipts fits the width", async ({ page }) => {
    test.setTimeout(300_000);
    await withPayment(page, { name: "r.png", buffer: makePng(100, 60) });
    await expect(page.getByRole("link", { name: "Open receipt 1 for Ali" })).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
