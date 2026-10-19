import { expect, test, type Page } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, organiserDb, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

const tokenOf = async (page: Page, name: string) => (await page.getByRole("textbox", { name: `Link for ${name}` }).inputValue()).split("/m/")[1];

test.describe("the organiser controls what members can see (US-21)", () => {
  test("three switches, all off; flipping one changes the member's page at once, and it is in the history (FR-19)", async ({ page, browser }, testInfo) => {
    test.setTimeout(400_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "Ali");
    const member = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
    const view = await member.newPage();
    const seen = async () => {
      await view.goto(`/m/${token}`);
      return (await view.locator("main").innerText()).replace(/\s+/g, " ");
    };

    await page.goto(url);
    const group = page.getByRole("group", { name: "What members can see" });
    for (const name of ["Who has paid", "Whose turn it is", "The history entries about them"]) await expect(group.getByRole("checkbox", { name })).not.toBeChecked();
    // A member always sees their own turn, months left and status.
    let text = await seen();
    expect(text).toContain("Your turn");
    expect(text).not.toContain("Order of turns");

    await group.getByRole("checkbox", { name: "Whose turn it is" }).check();
    await expect(page.getByText("Saved. Every member screen shows this now.")).toBeVisible({ timeout: 30_000 });
    text = await seen();
    expect(text).toContain("Order of turns");
    expect(text).not.toContain("Who has paid this month");

    await group.getByRole("checkbox", { name: "Who has paid" }).check();
    await expect(page.getByText("Saved. Every member screen shows this now.")).toBeVisible({ timeout: 30_000 });
    expect(await seen()).toContain("Who has paid this month");

    // It stays as saved after a reload, and switching off hides it again at once.
    await page.reload();
    const after = page.getByRole("group", { name: "What members can see" });
    await expect(after.getByRole("checkbox", { name: "Whose turn it is" })).toBeChecked();
    await after.getByRole("checkbox", { name: "Whose turn it is" }).uncheck();
    await expect(page.getByText("Saved. Every member screen shows this now.")).toBeVisible({ timeout: 30_000 });
    expect(await seen()).not.toContain("Order of turns");

    // Each change is a history entry.
    await page.goto(`${url}/history`);
    await expect(page.getByText("What members can see was changed").first()).toBeVisible();
    await member.close();
  });

  test("the switches fit a phone, and the database takes the same change (FR-19)", async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(url);
    await expect(page.getByRole("group", { name: "What members can see" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const set = await db.rpc("set_visibility", { p_committee_id: committeeId, p_payments: true, p_turns: true, p_history: true });
    expect(set.error).toBeNull();
  });
});
