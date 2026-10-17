import { expect, type Page } from "@playwright/test";

// One saved sign-in (made by auth.setup.ts) is reused by every test that needs a signed-in organiser,
// so the suite does not sign in dozens of times (Supabase limits sign-ins per minute).
export const ORGANISER_STATE = "playwright/.auth/organiser.json";
// A brand-new account with no committees, for tests that look at the empty state.
export const EMPTY_STATE = "playwright/.auth/empty-organiser.json";
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

/** Makes a committee through the guided flow and returns its address. `order` is the label of the turn-order choice. */
export async function createCommittee(page: Page, o: { periods: number; order: string; startDate?: string; name?: string }) {
  await page.goto("/committees/new");
  await page.getByLabel("Committee name").fill(o.name ?? `E2E ${Date.now()}`);
  await page.getByLabel("Instalment (Rs per period)").fill("1000");
  await page.getByLabel("Number of periods (2 to 30)").fill(String(o.periods));
  if (o.startDate) await page.getByLabel("Start date").fill(o.startDate);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("region", { name: "Turn order" }).getByText(o.order, { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create committee" }).click();
  await expect(page).toHaveURL(/\?created=1$/, { timeout: 15_000 });
  return page.url().split("?")[0];
}

/** On the Members page: adds a member holding one slot. */
export async function addMemberWithSlot(page: Page, name: string) {
  const form = page.getByRole("form", { name: "Add a member" });
  await form.getByLabel("Name").fill(name);
  await form.getByLabel("Slots").fill("1");
  await form.getByRole("button", { name: "Add member" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

/** Opens the Members page of a committee and adds one member with one slot for each name. */
export async function addMembers(page: Page, committeeUrl: string, names: string[]) {
  await page.goto(`${committeeUrl}/members`);
  for (const name of names) await addMemberWithSlot(page, name);
}
