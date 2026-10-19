import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, runningByHand, tokenOf } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

const memberEmail = process.env.CK_TEST_MEMBER_EMAIL ?? "";
const memberPassword = process.env.CK_TEST_MEMBER_PASSWORD ?? "";
test.skip(memberEmail === "" || memberPassword === "", "needs the member test login");


/** A new committee with Ali and مریم خان, and Ali's link. Returns the committee's name as shown, too. */
async function committeeWithLink(page: Page) {
  const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
  await page.goto(url);
  const name = (await page.locator("h1").first().innerText()).trim();
  await page.goto(`${url}/members`);
  return { name, token: await tokenOf(page, "Ali") };
}

/** A stranger's browser (not signed in). */
const stranger = (browser: Browser, testInfo: TestInfo) => browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });

async function signInAsMember(page: Page) {
  await page.getByLabel("Email").fill(memberEmail);
  await page.getByLabel("Password").fill(memberPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("an optional member account, view only (US-19)", () => {
  test("sign in from the link, add it once, and see it with the member's other committees (FR-17)", async ({ page, browser }, testInfo) => {
    test.setTimeout(400_000);
    const { name, token } = await committeeWithLink(page);
    const context = await stranger(browser, testInfo);
    const visitor = await context.newPage();

    // The link works without any account, and offers one.
    await visitor.goto(`/m/${token}`);
    await expect(visitor.getByRole("heading", { name: "Keep all your committees together" })).toBeVisible();
    await expect(visitor.getByText("Hello Ali")).toBeVisible();
    await visitor.getByRole("region", { name: "Keep all your committees together" }).getByRole("link", { name: "Sign in" }).click();
    await expect(visitor).toHaveURL(/\/sign-in\?next=/);
    await signInAsMember(visitor);
    // Signing in brings the member back to their link, not to the organiser's home.
    await expect(visitor).toHaveURL(new RegExp(`/m/${token}$`), { timeout: 30_000 });
    await visitor.getByRole("button", { name: "Add this link to my account" }).click();
    await expect(visitor).toHaveURL(/\/me$/, { timeout: 30_000 });
    await expect(visitor.getByRole("heading", { name: "My committees as a member" })).toBeVisible();
    const card = visitor.getByRole("link", { name: new RegExp(name) });
    await expect(card).toContainText("Ali");
    await card.click();
    await expect(visitor.getByText("Hello Ali")).toBeVisible();
    await expect(visitor.getByRole("heading", { name: "Your turn" })).toBeVisible();

    // The link page now says it is in the account.
    await visitor.goto(`/m/${token}`);
    await expect(visitor.getByText("This link is in your account.")).toBeVisible();

    // The account holds only member views: it shows no organiser data of its own.
    await visitor.goto("/committees");
    await expect(visitor.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
    await context.close();
  });

  test("each link attaches once: another account cannot take it over (FR-17)", async ({ page, browser }, testInfo) => {
    test.setTimeout(400_000);
    const { token } = await committeeWithLink(page);
    const context = await stranger(browser, testInfo);
    const member = await context.newPage();
    await member.goto(`/sign-in?next=${encodeURIComponent(`/m/${token}`)}`);
    await signInAsMember(member);
    await expect(member).toHaveURL(new RegExp(`/m/${token}$`), { timeout: 30_000 });
    await member.getByRole("button", { name: "Add this link to my account" }).click();
    await expect(member).toHaveURL(/\/me$/, { timeout: 30_000 });

    // The organiser's own account opens the same link and cannot add it.
    await page.goto(`/m/${token}`);
    await page.getByRole("button", { name: "Add this link to my account" }).click();
    await expect(page.getByText(/already belong to an account/)).toBeVisible({ timeout: 30_000 });
    await context.close();
  });

  test("signing out ends this device only; and /me needs a sign-in (FR-17)", async ({ browser }, testInfo) => {
    test.setTimeout(400_000);
    const first = await stranger(browser, testInfo);
    const second = await stranger(browser, testInfo);
    const a = await first.newPage();
    const b = await second.newPage();

    // Signed out, /me goes to sign-in and remembers where to come back to.
    await a.goto("/me");
    await expect(a).toHaveURL(/\/sign-in\?next=%2Fme/);
    await signInAsMember(a);
    await expect(a).toHaveURL(/\/me$/, { timeout: 30_000 });
    await b.goto("/me");
    await signInAsMember(b);
    await expect(b).toHaveURL(/\/me$/, { timeout: 30_000 });

    await a.getByRole("button", { name: "Sign out of this device" }).click();
    await expect(a).toHaveURL(/\/$/, { timeout: 30_000 });
    await a.goto("/me");
    await expect(a).toHaveURL(/\/sign-in/);
    // The other device is still signed in.
    await b.reload();
    await expect(b.getByRole("heading", { name: "My committees as a member" })).toBeVisible();
    await first.close();
    await second.close();
  });

  test("a bad address after signing in never leaves the app (FR-17)", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const context = await stranger(browser, testInfo);
    const page = await context.newPage();
    await page.goto(`/sign-in?next=${encodeURIComponent("https://evil.example/steal")}`);
    await signInAsMember(page);
    await expect(page).toHaveURL(/\/committees$/, { timeout: 30_000 });
    await context.close();
  });

  test("the account area fits a phone", async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const context = await stranger(browser, testInfo);
    const page = await context.newPage();
    await page.goto("/sign-in?next=%2Fme");
    await signInAsMember(page);
    await expect(page.getByRole("heading", { name: "My committees as a member" })).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await context.close();
  });
});
