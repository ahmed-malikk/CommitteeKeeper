import { test as setup } from "@playwright/test";
import { EMPTY_STATE, ORGANISER_STATE, hasLogin, signInThroughTheForm } from "./helpers";

// Signs in once and saves the session for the other tests to reuse.
setup("sign in as the test organiser", async ({ page }) => {
  setup.skip(!hasLogin, "CK_TEST_ORG_A_EMAIL and CK_TEST_ORG_A_PASSWORD are not set");
  await signInThroughTheForm(page);
  await page.context().storageState({ path: ORGANISER_STATE });
});

// A new account every run, so some tests can see what a person with no committees sees.
setup("sign up a fresh organiser with no committees", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Email").fill(`ck-e2e-empty-${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("a-long-test-password-1");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/committees$/);
  await page.context().storageState({ path: EMPTY_STATE });
});
