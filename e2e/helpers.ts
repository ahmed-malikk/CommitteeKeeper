import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// One saved sign-in (made by auth.setup.ts) is reused by every test that needs a signed-in organiser,
// so the suite does not sign in dozens of times (Supabase limits sign-ins per minute).
export const ORGANISER_STATE = "playwright/.auth/organiser.json";
// A brand-new account with no committees, for tests that look at the empty state.
export const EMPTY_STATE = "playwright/.auth/empty-organiser.json";
/** A second new organiser every run, for the tests that look at the list of committees (the main test account has hundreds by now, which would make that screen slow). */
export const LISTS_STATE = "playwright/.auth/lists-organiser.json";
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

/** The organiser's own database session, signed in like the app does it (publishable key only; no secret key). */
export async function organiserDb() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", { auth: { persistSession: false } });
  const { error } = await db.auth.signInWithPassword({ email: login.email, password: login.password });
  if (error) throw new Error(`Could not sign in for the database: ${error.message}`);
  return db;
}

/** Today in Pakistan (UTC+5), as the database counts it. */
const pakistanToday = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Records the payout of every turn straight in the database, as the organiser. The payout screen is a later feature;
 * this lets the test reach "every turn paid out" so completing a committee can be tried now.
 */
export async function payOutAllTurns(committeeUrl: string) {
  const committeeId = committeeUrl.split("/").pop() as string;
  const db = await organiserDb();
  const committee = await db.from("committees").select("amount, periods").eq("id", committeeId).single();
  if (committee.error) throw new Error(committee.error.message);
  const slots = await db.from("slots").select("id").eq("committee_id", committeeId);
  for (const slot of slots.data ?? []) {
    // Each holder receives the instalment for every period they covered (a slot that changed hands has more than one).
    const holders = await db.from("slot_holders").select("member_id, from_period, to_period").eq("slot_id", slot.id);
    const totals = new Map<string, number>();
    for (const h of holders.data ?? []) {
      const periods = (h.to_period ?? committee.data.periods) - h.from_period + 1;
      totals.set(h.member_id, (totals.get(h.member_id) ?? 0) + committee.data.amount * periods);
    }
    const paid = await db.rpc("record_payout", {
      p_committee_id: committeeId,
      p_slot_id: slot.id,
      p_paid_on: pakistanToday(),
      p_split: [...totals].map(([member_id, amount]) => ({ member_id, amount })),
    });
    if (paid.error) throw new Error(`record_payout failed: ${paid.error.message}`);
  }
}
