import { expect, test, type Browser, type TestInfo } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, organiserDb, runningByHand, openLinkSettings, tokenOf } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** Opens an address as a stranger (not signed in) and returns what they get. */
async function asStranger(browser: Browser, testInfo: TestInfo, path: string) {
  const context = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
  const page = await context.newPage();
  const response = await page.goto(path);
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ").trim();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await context.close();
  return { status: response?.status() ?? 0, text, overflow };
}

test.describe("a private link for each member (US-17)", () => {
  test("the link opens that member's page for a stranger, and shows nobody else's details (FR-15)", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const members = await db.from("members").select("id, name").eq("committee_id", committeeId);
    const sara = members.data!.find((m) => m.name === "مریم خان")!;
    await db.rpc("update_member", { p_committee_id: committeeId, p_member_id: sara.id, p_name: "مریم خان", p_email: "maryam-private@example.test", p_phone: "0300 7654321" });

    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "Ali");
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const seen = await asStranger(browser, testInfo, `/m/${token}`);
    expect(seen.status).toBe(200);
    expect(seen.text).toContain("Hello Ali");
    // Another member's name, email and phone, and the link itself, never appear.
    expect(seen.text).not.toContain("مریم");
    expect(seen.text).not.toContain("maryam-private");
    expect(seen.text).not.toContain("7654321");
    expect(seen.text).not.toContain(token);
  });

  test("a wrong link, an unknown link and a switched-off link all give the same empty answer (FR-15, TC-047)", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "Ali");

    const unknown = await asStranger(browser, testInfo, `/m/${"A".repeat(43)}`);
    const malformed = await asStranger(browser, testInfo, "/m/not-a-link");
    expect(unknown.status).toBe(404);
    expect(unknown.text).toContain("This link doesn’t work");

    // Switch it off: the very same answer as one that never existed.
    await openLinkSettings(page, "Ali");
    await page.getByRole("button", { name: "Turn off the link for Ali" }).click();
    await expect(page.getByText("Anyone who opens it sees nothing.")).toBeVisible({ timeout: 30_000 });
    const off = await asStranger(browser, testInfo, `/m/${token}`);
    expect(off.status).toBe(unknown.status);
    expect(off.text).toBe(unknown.text);
    expect(malformed.status).toBe(unknown.status);
    expect(malformed.text).toBe(unknown.text);

    // And back on: it works again, with the same link.
    await page.getByRole("button", { name: "Turn on the link for Ali" }).click();
    await expect(page.getByRole("group", { name: "Private link for Ali" }).getByText("Link on")).toBeVisible({ timeout: 30_000 });
    const on = await asStranger(browser, testInfo, `/m/${token}`);
    expect(on.status).toBe(200);
    expect(on.text).toContain("Hello Ali");
  });

  test("a new link replaces the old one, and the old one stops working at once (FR-15)", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    const oldToken = await tokenOf(page, "Ali");

    await openLinkSettings(page, "Ali");
    await page.getByRole("button", { name: "Make a new link for Ali" }).click();
    const confirm = page.getByRole("group", { name: "Confirm a new link for Ali" });
    await expect(confirm).toBeFocused();
    await confirm.getByRole("button", { name: "Yes, make a new link" }).click();
    await expect(async () => {
      expect(await tokenOf(page, "Ali")).not.toBe(oldToken);
    }).toPass({ timeout: 30_000 });
    const newToken = await tokenOf(page, "Ali");

    expect((await asStranger(browser, testInfo, `/m/${oldToken}`)).status).toBe(404);
    const fresh = await asStranger(browser, testInfo, `/m/${newToken}`);
    expect(fresh.status).toBe(200);
    expect(fresh.text).toContain("Hello Ali");
  });

  test("the link controls and the member page fit a phone, with Urdu-script names", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    await expect(page.getByRole("group", { name: "Private link for مریم خان" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const token = await tokenOf(page, "مریم خان");
    const seen = await asStranger(browser, testInfo, `/m/${token}`);
    expect(seen.text).toContain("مریم خان");
    expect(seen.overflow).toBeLessThanOrEqual(0);
  });
});
