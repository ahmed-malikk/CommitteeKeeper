import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LISTS_STATE, ORGANISER_STATE, SIGNED_OUT, hasLogin, organiserDb, runningByHand, tokenOf } from "./helpers";

// An automated accessibility scan (axe-core) of every main screen against WCAG 2.2 AA, at laptop and phone size
// (the three Playwright projects). It finds what a machine can: contrast, names and labels, roles, landmarks, headings.
// It cannot find everything, so the keyboard and screen-reader behaviour is also checked in the feature tests.

async function scan(page: Page, label: string) {
  // Screens fade in; scanning halfway through the fade reads the colours as washed out. Test the finished screen.
  await page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const report = result.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`);
  expect(report, `${label}\n${report.join("\n")}`).toEqual([]);
}

test.describe("accessibility scan: public pages", () => {
  test.use({ storageState: SIGNED_OUT });
  for (const path of ["/", "/sign-in", "/sign-up", "/privacy", "/how-its-built", `/m/${"A".repeat(43)}`]) {
    test(`${path === `/m/${"A".repeat(43)}` ? "a link that does not work" : path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("main")).toBeVisible();
      await scan(page, path);
    });
  }
});

test.describe("accessibility scan: the organiser's screens", () => {
  test.use({ storageState: ORGANISER_STATE });
  test.skip(!hasLogin, "needs the test login");

  test("a running committee: agreement, members, turns, payments, reminders, history", async ({ page }) => {
    test.setTimeout(400_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    for (const [name, path] of [
      ["agreement", ""],
      ["members", "/members"],
      ["turns", "/turns"],
      ["payments", "/payments"],
      ["reminders", "/reminders"],
      ["history", "/history"],
    ] as const) {
      await page.goto(`${url}${path}`);
      await expect(page.locator("main")).toBeVisible();
      await scan(page, name);
    }
  });

  test("the QR dialog and the new committee guide", async ({ page }) => {
    test.setTimeout(400_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);
    await page.getByRole("button", { name: "Show QR code for Ali" }).click();
    await expect(page.getByRole("dialog", { name: "QR code for Ali" })).toBeVisible();
    await scan(page, "QR dialog");
    await page.keyboard.press("Escape");
    await page.goto("/committees/new");
    await expect(page.locator("main")).toBeVisible();
    await scan(page, "new committee");
  });

  test("a member's own page, with everything the organiser allows switched on", async ({ page, browser }, testInfo) => {
    test.setTimeout(400_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    await db.rpc("set_visibility", { p_committee_id: committeeId, p_payments: true, p_turns: true, p_history: true });
    await page.goto(`${url}/members`);
    const token = await tokenOf(page, "Ali");
    const context = await browser.newContext({ storageState: SIGNED_OUT, baseURL: testInfo.project.use.baseURL });
    const member = await context.newPage();
    await member.goto(`/m/${token}`);
    await expect(member.getByText("Hello Ali")).toBeVisible();
    await scan(member, "member page");
    await context.close();
  });
});

test.describe("accessibility scan: the committee list", () => {
  test.use({ storageState: LISTS_STATE });

  test("home with and without committees", async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto("/committees");
    await expect(page.getByRole("heading", { name: "My committees" })).toBeVisible();
    await scan(page, "home, empty");
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    expect(url).toContain("/committees/");
    await page.goto("/committees");
    await expect(page.getByRole("region", { name: "All committees" })).toBeVisible();
    await scan(page, "home, with a committee");
  });
});
