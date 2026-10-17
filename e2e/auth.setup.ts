import { test as setup } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, signInThroughTheForm } from "./helpers";

// Signs in once and saves the session for the other tests to reuse.
setup("sign in as the test organiser", async ({ page }) => {
  setup.skip(!hasLogin, "CK_TEST_ORG_A_EMAIL and CK_TEST_ORG_A_PASSWORD are not set");
  await signInThroughTheForm(page);
  await page.context().storageState({ path: ORGANISER_STATE });
});
