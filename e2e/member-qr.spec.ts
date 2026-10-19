import jsQR from "jsqr";
import { PNG } from "pngjs";
import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, runningByHand, openLinkSettings, tokenOf } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** Reads the QR code on screen the way a phone camera would, and returns the address it holds. */
async function scan(page: Page): Promise<string | null> {
  const picture = await page.locator(".qrbox").screenshot();
  const png = PNG.sync.read(picture);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
}

test.describe("a member's link as a QR code (US-17b)", () => {
  test("opens from the link row, scans to the member's own link, and closes with Escape or Done (FR-15)", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    const link = `${testInfo.project.use.baseURL}/m/${await tokenOf(page, "Ali")}`;

    const open = page.getByRole("button", { name: "Show QR code for Ali" });
    await open.click();
    const dialog = page.getByRole("dialog", { name: "QR code for Ali" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("img", { name: "QR code for Ali's link" })).toHaveAttribute("data-link", link);
    // A camera reads exactly the member's link from it.
    expect(await scan(page)).toBe(link);
    await expect(dialog).toContainText("Ask Ali to point their phone camera at this");

    // The scanned address really is Ali's page, for someone who is not signed in.
    const stranger = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
    const view = await stranger.newPage();
    await view.goto(new URL(link).pathname);
    await expect(view.getByText("Hello Ali")).toBeVisible();
    await stranger.close();

    // Escape closes it and focus returns to the button; so does Done.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(dialog).toBeHidden();
  });

  test("always matches the current link, and a switched-off link has no QR code (FR-15)", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    const oldToken = await tokenOf(page, "Ali");

    await openLinkSettings(page, "Ali");
    await page.getByRole("button", { name: "Make a new link for Ali" }).click();
    await page.getByRole("button", { name: "Yes, make a new link" }).click();
    await expect(async () => {
      expect(await tokenOf(page, "Ali")).not.toBe(oldToken);
    }).toPass({ timeout: 30_000 });
    const newLink = `${testInfo.project.use.baseURL}/m/${await tokenOf(page, "Ali")}`;
    await page.getByRole("button", { name: "Show QR code for Ali" }).click();
    expect(await scan(page)).toBe(newLink);
    await page.keyboard.press("Escape");

    await openLinkSettings(page, "Ali");
    await page.getByRole("button", { name: "Turn off the link for Ali" }).click();
    await expect(page.getByText("Anyone who opens it sees nothing.")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Show QR code for Ali" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Show QR code for مریم خان" })).toBeVisible();
  });

  test("fits a phone, with an Urdu-script name (FR-15)", async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    await page.getByRole("button", { name: "Show QR code for مریم خان" }).click();
    const dialog = page.getByRole("dialog", { name: "QR code for مریم خان" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
