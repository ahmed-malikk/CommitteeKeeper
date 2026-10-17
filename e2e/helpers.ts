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

/** On the Agreement page of a committee that is ready: starts it and waits until it is running. */
export async function startCommitteeOnPage(page: Page, committeeUrl: string) {
  await page.goto(committeeUrl);
  await page.getByRole("button", { name: "Start committee" }).click();
  await page.getByRole("button", { name: "Yes, start it" }).click();
  await expect(page.getByText("This committee is running.")).toBeVisible({ timeout: 15_000 });
}

/** A committee with one member per name (one slot each) and a start date in the past, so it can start as already running. */
export async function committeeWithMembers(page: Page, o: { order: string; names: string[] }) {
  const url = await createCommittee(page, { periods: o.names.length, order: o.order, startDate: "2026-01-15" });
  await addMembers(page, url, o.names);
  return url;
}

/**
 * A running committee whose order was set by hand: the first name is moved one place later, so the turns run
 * names[1], names[0], names[2], ... Returns the address and that order.
 */
export async function runningByHand(page: Page, names: string[]) {
  const url = await createCommittee(page, { periods: names.length, order: "Set the order by hand", startDate: "2026-01-15" });
  await addMembers(page, url, names);
  await page.goto(`${url}/turns`);
  await page.getByRole("button", { name: `Move ${names[0]} later` }).click();
  await page.getByRole("button", { name: "Save order" }).click();
  await expect(page.getByText("Order saved.")).toBeVisible();
  await startCommitteeOnPage(page, url);
  return { url, order: [names[1], names[0], ...names.slice(2)] };
}
