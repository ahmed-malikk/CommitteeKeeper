import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, organiserDb, runningByHand, tokenOf } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

/** Opens a member's link as a stranger and returns the page's text and its raw HTML. */
async function asStranger(browser: Browser, testInfo: TestInfo, path: string) {
  const context = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
  const page = await context.newPage();
  await page.goto(path);
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ").trim();
  const html = await page.content();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await context.close();
  return { text, html, overflow };
}


// Two members, two periods, Rs 1,000 a month, running since January 2026. The order is مریم خان first, then Ali.
test.describe("the member's own view (US-18, US-21)", () => {
  test("shows my own turn, the months left and the status, and nobody else by default (FR-16, FR-19)", { tag: "@smoke" }, async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const members = await db.from("members").select("id, name").eq("committee_id", committeeId);
    const ali = members.data!.find((m) => m.name === "Ali")!;
    await db.rpc("update_member", { p_committee_id: committeeId, p_member_id: ali.id, p_name: "Ali", p_email: "ali-private@example.test", p_phone: "0300 1112223" });
    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "Ali");

    const seen = await asStranger(browser, testInfo, `/m/${token}`);
    expect(seen.text).toContain("Hello Ali");
    expect(seen.text).toContain("Running");
    expect(seen.text).toMatch(/This is the last month \(2 of 2\)|Month \d+ of 2/);
    expect(seen.text).toContain("Your turn");
    expect(seen.text).toMatch(/Turn 2: the pot comes to you in Feb 2026\./);
    expect(seen.text).toContain("Each month: Rs 1,000");
    // Nobody else's turn, payments or history, and none of the member's own contact details or the link, by default.
    expect(seen.text).not.toContain("Order of turns");
    expect(seen.text).not.toContain("Who has paid");
    expect(seen.text).not.toContain("What the record says");
    expect(seen.text).not.toContain("مریم");
    for (const secret of ["ali-private", "1112223"]) {
      expect(seen.text).not.toContain(secret);
      expect(seen.html).not.toContain(secret);
    }
    expect(seen.text).not.toContain(token);
  });

  test("shows the order, who has paid and my own history entries only after the organiser allows them, at once (FR-16, FR-19)", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "Ali");

    expect((await asStranger(browser, testInfo, `/m/${token}`)).text).not.toContain("Order of turns");
    const set = await db.rpc("set_visibility", { p_committee_id: committeeId, p_payments: true, p_turns: true, p_history: true });
    expect(set.error).toBeNull();

    const seen = await asStranger(browser, testInfo, `/m/${token}`);
    expect(seen.text).toContain("Order of turns");
    expect(seen.text).toContain("You");
    expect(seen.text).toContain("مریم خان");
    expect(seen.text).toContain("Who has paid this month");
    expect(seen.text).toContain("What the record says about you");
    expect(seen.text).toContain("You were given a slot");
    // Never any amounts or notes of other people, and never their contact details.
    expect(seen.text).not.toMatch(/@example\.test/);
  });

  test("fits a phone, with Urdu-script names", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    await db.rpc("set_visibility", { p_committee_id: committeeId, p_payments: true, p_turns: true, p_history: true });
    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "مریم خان");
    const seen = await asStranger(browser, testInfo, `/m/${token}`);
    expect(seen.text).toContain("Hello مریم خان");
    expect(seen.overflow).toBeLessThanOrEqual(0);
  });
});
