import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, SIGNED_OUT, hasLogin, login, signInThroughTheForm } from "./helpers";

const isPhone = () => test.info().project.name === "phone-375";

test.describe("signed out", () => {
  test.use({ storageState: SIGNED_OUT });

  test("the sign-in page asks for email and password", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible();
  });

  test("opening a committee page while signed out goes to sign-in and shows no data (TC-003)", async ({ page }) => {
    await page.goto("/committees");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "No committees yet" })).toHaveCount(0);
  });

  test("an empty form says what is missing", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Enter your password.")).toBeVisible();
  });

  test("a wrong password gives the real reason, and nobody is signed in afterwards (TC-002, TC-004)", async ({ page }) => {
    test.skip(!hasLogin, "needs the test login");
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(login.email);
    await page.getByLabel("Password").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Wrong email or password" })).toBeVisible();
    await page.goto("/committees");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("sign-up asks for a long enough password", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill("someone@example.test");
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Use at least 8 characters.", { exact: true }).last()).toBeVisible();
  });

  test("a new organiser can sign up and lands on an empty home (TC-001)", async ({ page }) => {
    const email = `ck-e2e-${Date.now()}-${test.info().project.name}@example.test`;
    await page.goto("/sign-up");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("a-long-test-password-1");
    await page.getByRole("button", { name: "Create account" }).click();
    // If this stalls on "Check your email", Confirm email is still switched on in Supabase (Authentication, Sign In / Providers, Email).
    await expect(page).toHaveURL(/\/committees$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "No committees yet" })).toBeVisible();
  });

  test("signing in, then signing out, ends this browser's session (TC-004)", { tag: "@smoke" }, async ({ page }) => {
    test.skip(!hasLogin, "needs the test login");
    await signInThroughTheForm(page);
    if (!isPhone()) await expect(page.locator(".rail .who")).toHaveText(login.email);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/committees");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("signing out here leaves the account signed in on another device (C4)", async ({ browser, baseURL }) => {
    test.skip(!hasLogin, "needs the test login");
    const here = await browser.newContext({ baseURL });
    const other = await browser.newContext({ baseURL });
    const pageHere = await here.newPage();
    const pageOther = await other.newPage();
    await signInThroughTheForm(pageHere);
    await signInThroughTheForm(pageOther);
    await pageHere.getByRole("button", { name: "Sign out" }).click();
    await expect(pageHere).toHaveURL(/\/$/);
    await pageOther.goto("/committees");
    await expect(pageOther).toHaveURL(/\/committees$/);
    await here.close();
    await other.close();
  });
});

test.describe("signed in", () => {
  test.use({ storageState: ORGANISER_STATE });

  test("a signed-in organiser is taken past the sign-in page", async ({ page }) => {
    test.skip(!hasLogin, "needs the test login");
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/committees$/);
  });

  test("the public pages offer 'My committees' instead of sign-in", async ({ page }) => {
    test.skip(!hasLogin, "needs the test login");
    await page.goto("/");
    await expect(page.getByRole("link", { name: "My committees" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toHaveCount(0);
  });
});
