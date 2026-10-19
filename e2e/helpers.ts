import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One saved sign-in (made by auth.setup.ts) is reused by every test that needs a signed-in organiser,
// so the suite does not sign in dozens of times (Supabase limits sign-ins per minute).
export const ORGANISER_STATE = "playwright/.auth/organiser.json";
// A brand-new account with no committees, for tests that look at the empty state.
export const EMPTY_STATE = "playwright/.auth/empty-organiser.json";
/** A second new organiser every run, for the tests that look at the list of committees (the main test account has hundreds by now, which would make that screen slow). */
export const LISTS_STATE = "playwright/.auth/lists-organiser.json";
/** The login of that second organiser (written by the setup step), for seeding its data through the database. */
export const LISTS_LOGIN = "playwright/.auth/lists-login.json";
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

/** A committee with one member per name (one slot each) and a start date in the past, so it can start as already running. (Seeded through the database.) */
export async function committeeWithMembers(_page: Page, o: { order: string; names: string[]; as?: Account }) {
  const { url } = await seedCommittee({ names: o.names, method: ORDER_BY_LABEL[o.order] ?? "hand", periods: o.names.length, as: o.as });
  return url;
}

/**
 * A running committee whose order was set by hand: the first name is moved one place later, so the turns run
 * names[1], names[0], names[2], ... Returns the address and that order. (Seeded through the database; the page is not needed.)
 */
export async function runningByHand(_page: Page, names: string[], as?: Account) {
  const { url, order } = await seedCommittee({ names, method: "hand", periods: names.length, start: true, moveFirstLater: true, as });
  return { url, order };
}

/** Starts a committee through the database (the same function the Start button calls). For tests where starting is only setup. */
export async function startViaDb(committeeUrl: string, account: Account = "main") {
  const db = await organiserDb(account);
  const started = await db.rpc("start_committee", { p_committee_id: committeeUrl.split("/").pop() as string });
  if (started.error) throw new Error(`seed: start_committee failed: ${started.error.message}`);
}

/** The first day of next month in Pakistan, which is what a new committee's start date defaults to. */
export function nextMonthStart(): string {
  const now = new Date(Date.now() + 5 * 3_600_000);
  const y = now.getUTCMonth() === 11 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const m = (now.getUTCMonth() + 1) % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

/** Which test organiser a database session or a seeded committee belongs to: the main account, or the second one used by the list screens. */
export type Account = "main" | "lists";

/**
 * An organiser's own database session, signed in like the app does it (publishable key only; no secret key).
 * Each worker signs in once per account and reuses the session (Supabase limits sign-ins per minute, and most tests seed data).
 */
const sessions = new Map<Account, Promise<SupabaseClient>>();
export function organiserDb(account: Account = "main") {
  let session = sessions.get(account);
  if (!session) {
    session = (async () => {
      const who = account === "lists" ? (JSON.parse(readFileSync(LISTS_LOGIN, "utf-8")) as { email: string; password: string }) : login;
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", { auth: { persistSession: false } });
      const { error } = await db.auth.signInWithPassword({ email: who.email, password: who.password });
      if (error) throw new Error(`Could not sign in for the database: ${error.message}`);
      return db;
    })();
    // A failed sign-in is not kept, so the next test can try again.
    session.catch(() => sessions.delete(account));
    sessions.set(account, session);
  }
  return session;
}

export type OrderMethod = "hand" | "draw_start" | "draw_monthly";
/** The turn-order choices as the screens word them, for tests that used to click them. */
export const ORDER_BY_LABEL: Record<string, OrderMethod> = {
  "Set the order by hand": "hand",
  "Draw all turns at the start": "draw_start",
  "Draw each month": "draw_monthly",
};

export type Seed = {
  /** One member per name, in this order. */
  names: string[];
  /** How turns are decided. Defaults to by hand. */
  method?: OrderMethod;
  /** Number of periods; defaults to one per slot. */
  periods?: number;
  /** Slots per member (default 1 each). */
  slots?: number[];
  startDate?: string;
  name?: string;
  /** Start the committee (it needs every slot given out and, for "by hand", the order saved). */
  start?: boolean;
  /** By hand only: move the first name one place later, so turns run names[1], names[0], names[2]... */
  moveFirstLater?: boolean;
  /** Whose committee it is. */
  as?: Account;
};

/**
 * Makes a committee straight through the database, as the organiser, in about a second: the same functions the screens call,
 * so the committee is exactly what clicking through the guided flow would make. Use it whenever creating or starting the
 * committee is only setup; the tests that are about the guided flow itself still click through it. The address is relative.
 */
export async function seedCommittee(o: Seed) {
  const db = await organiserDb(o.as ?? "main");
  const slotsPer = o.names.map((_, i) => o.slots?.[i] ?? 1);
  const periods = o.periods ?? Math.max(2, slotsPer.reduce((a, b) => a + b, 0));
  const created = await db.rpc("create_committee", {
    p_name: o.name ?? `E2E ${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    p_amount: 1000,
    p_periods: periods,
    p_start_date: o.startDate ?? "2026-01-15",
    p_due_day: 10,
    p_grace_days: 0,
    p_order_method: o.method ?? "hand",
  });
  if (created.error) throw new Error(`seed: create_committee failed: ${created.error.message}`);
  const id = created.data as string;

  const slotIds: string[][] = [];
  for (let i = 0; i < o.names.length; i++) {
    const member = await db.rpc("add_member", { p_committee_id: id, p_name: o.names[i] });
    if (member.error) throw new Error(`seed: add_member failed: ${member.error.message}`);
    const mine: string[] = [];
    for (let k = 0; k < slotsPer[i]; k++) {
      const slot = await db.rpc("add_slot", { p_committee_id: id, p_member_id: member.data as string });
      if (slot.error) throw new Error(`seed: add_slot failed: ${slot.error.message}`);
      mine.push(slot.data as string);
    }
    slotIds.push(mine);
  }

  let order = o.names;
  if ((o.method ?? "hand") === "hand" && o.names.length > 0) {
    const moved = o.moveFirstLater && o.names.length > 1;
    const arranged = moved ? [...slotIds.slice(1, 2), slotIds[0], ...slotIds.slice(2)] : slotIds;
    order = moved ? [o.names[1], o.names[0], ...o.names.slice(2)] : o.names;
    const saved = await db.rpc("set_order", { p_committee_id: id, p_slot_ids: arranged.flat(), p_reason: null });
    if (saved.error) throw new Error(`seed: set_order failed: ${saved.error.message}`);
  }
  if (o.start) {
    const started = await db.rpc("start_committee", { p_committee_id: id });
    if (started.error) throw new Error(`seed: start_committee failed: ${started.error.message}`);
  }
  return { url: `/committees/${id}`, id, order };
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

/**
 * A member's private link token, read straight from the database as the organiser. The Members page shows Copy link and QR code
 * buttons, not the address, so a test that needs the address asks for it here. Call it while on one of the committee's pages.
 */
export async function tokenOf(page: Page, name: string): Promise<string> {
  const committeeId = /\/committees\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  if (!committeeId) throw new Error(`tokenOf needs a committee page, but the page is ${page.url()}`);
  const db = await organiserDb();
  const row = await db.from("members").select("link_token").eq("committee_id", committeeId).eq("name", name).single();
  if (row.error) throw new Error(`No member called ${name}: ${row.error.message}`);
  return row.data.link_token as string;
}

/** Opens the "Link settings" disclosure of one member's link row (Turn off, New link). */
export async function openLinkSettings(page: Page, name: string) {
  await page.getByRole("group", { name: `Private link for ${name}` }).getByText("Link settings").click();
}
