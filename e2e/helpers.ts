import { expect, type Page } from "@playwright/test";

// One saved sign-in (made by auth.setup.ts) is reused by every test that needs a signed-in organiser,
// so the suite does not sign in dozens of times (Supabase limits sign-ins per minute).
export const ORGANISER_STATE = "playwright/.auth/organiser.json";
export const SIGNED_OUT = { cookies: [], origins: [] };

export const login = {
  email: process.env.CK_TEST_ORG_A_EMAIL ?? "",
  password: process.env.CK_TEST_ORG_A_PASSWORD ?? "",
};
export const hasLogin = login.email !== "" && login.password !== "";

/** Fills in and submits the sign-in form, then waits to land on the organiser's home. */
export async function signInThroughTheForm(page: Page, email = login.email, password = login.password) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/committees$/);
}
