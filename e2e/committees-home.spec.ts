import { expect, test } from "@playwright/test";
import { LISTS_STATE, hasLogin, organiserDb, seedCommittee } from "./helpers";

test.use({ storageState: LISTS_STATE });
test.skip(!hasLogin, "needs the test login");

test.describe("the organiser's home screen (US-22)", () => {
  test("a running committee shows how many are late, and the long-late ones are listed first", async ({ page }) => {
    test.setTimeout(180_000);
    const name = `Home ${Date.now()}`;
    // Began in January 2026 with 2 periods and nothing recorded: 2 slots x 2 periods = 4 late instalments.
    await seedCommittee({ names: ["Ali", "مریم خان"], method: "hand", periods: 2, startDate: "2026-01-15", name, start: true, moveFirstLater: true, as: "lists" });

    await page.goto("/committees");
    const row = page.getByRole("region", { name: "All committees" }).getByRole("link", { name: new RegExp(name) });
    await expect(row).toContainText("You organise");
    await expect(row).toContainText("4 late");
    await expect(row).toContainText("Running");

    const needs = page.getByRole("region", { name: "Needs you today" });
    await expect(needs).toBeVisible();
    // Every line says who is how many days late.
    await expect(needs.getByRole("link").first()).toContainText(/is late by \d+ days?/);
  });

  test("a committee that has not started shows no late count", async ({ page }) => {
    test.setTimeout(120_000);
    const name = `Forming ${Date.now()}`;
    await seedCommittee({ names: [], periods: 2, method: "draw_monthly", name, as: "lists" });
    await page.goto("/committees");
    const row = page.getByRole("region", { name: "All committees" }).getByRole("link", { name: new RegExp(name) });
    await expect(row).toContainText("Forming");
    await expect(row).not.toContainText("late");
  });

  test("the home screen fits a phone and a long Urdu-script name does not break it", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    const name = `بہت لمبا نام والی کمیٹی ${stamp} Very Long Name For The Area`;
    await seedCommittee({ names: [], periods: 2, method: "draw_monthly", name, as: "lists" });
    await page.goto("/committees");
    await expect(page.getByRole("link", { name: new RegExp(String(stamp)) })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("a person who organises one committee and is a member of another sees both, kept apart (FR-20)", async ({ page }) => {
    test.setTimeout(180_000);
    const stamp = Date.now();
    const mine = `Organised ${stamp}`;
    const theirs = `Joined ${stamp}`;
    // Somebody else's committee (the main test organiser's) with a member, Sana, whose link this account adds to itself.
    const other = await seedCommittee({ names: ["Sana", "Bilal"], name: theirs, start: true, moveFirstLater: true });
    const row = await (await organiserDb()).from("members").select("link_token").eq("committee_id", other.id).eq("name", "Sana").single();
    expect(row.error).toBeNull();
    const attached = await (await organiserDb("lists")).rpc("attach_account", { p_token: row.data?.link_token as string });
    expect(attached.data).toBe(true);
    await seedCommittee({ names: [], periods: 2, method: "draw_monthly", name: mine, as: "lists" });

    await page.goto("/committees");
    const organised = page.getByRole("region", { name: "All committees" });
    await expect(organised.getByRole("link", { name: new RegExp(mine) })).toContainText("You organise");
    await expect(organised.getByRole("link", { name: new RegExp(theirs) })).toHaveCount(0);

    const member = page.getByRole("region", { name: "Committees where you are a member" });
    const card = member.getByRole("link", { name: new RegExp(theirs) });
    await expect(card).toContainText("Sana");
    await expect(card).toContainText("Running");
    await expect(member.getByRole("link", { name: new RegExp(mine) })).toHaveCount(0);
    // The member's own page for it opens from here.
    await card.click();
    await expect(page.getByText("Hello Sana")).toBeVisible();
  });
});
