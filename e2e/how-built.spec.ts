import { expect, test } from "@playwright/test";
import { SIGNED_OUT } from "./helpers";

test.use({ storageState: SIGNED_OUT });

test.describe("the How it's built page (US-24)", () => {
  test("covers who, the story, the problem, the stack, the architecture, the tests, the links and the credits (FR-22)", { tag: "@smoke" }, async ({ page }) => {
    await page.goto("/how-its-built");
    await expect(page.getByRole("heading", { level: 1, name: "How it’s built" })).toBeVisible();
    for (const name of ["Who built it", "The story", "The problem", "The stack", "How it fits together", "How it is tested", "Links", "Credits"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
    }
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(text).toContain("Ahmed Malik");
    expect(text).toMatch(/Next\.js 16/);
    expect(text).toMatch(/Red Hat Display/);
    // Real numbers only: the counts are filled in from a test run, never left at zero.
    const counts = /(\d+) unit tests and (\d+) system tests/.exec(text);
    expect(counts).not.toBeNull();
    expect(Number(counts![1])).toBeGreaterThan(0);
    expect(Number(counts![2])).toBeGreaterThan(0);
    // The page is part of the product, so it never says how it was made with other tools or what inspired it.
    expect(text).not.toMatch(/inspir|AI-generated|ChatGPT|Claude/i);
  });

  test("every link works (FR-22)", async ({ page, request }) => {
    test.setTimeout(120_000);
    await page.goto("/how-its-built");
    const links = await page.locator("main a[href]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href));
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const href of links) {
      const response = await request.get(href, { maxRedirects: 5 });
      expect(response.status(), href).toBeLessThan(400);
    }
  });

  test("fits a phone", async ({ page }) => {
    await page.goto("/how-its-built");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
