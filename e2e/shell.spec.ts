import { expect, test } from "@playwright/test";
import { EMPTY_STATE, ORGANISER_STATE } from "./helpers";

// These pages need a signed-in organiser: reuse the saved sign-in.
test.use({ storageState: ORGANISER_STATE });

const isPhone = () => test.info().project.name === "phone-375";

test.describe("on a new account", () => {
  test.use({ storageState: EMPTY_STATE });
  test("committees page shows the empty state inside the app shell", async ({ page }) => {
    await page.goto("/committees");
    await expect(page.getByRole("heading", { name: "My committees" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "No committees yet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New committee" })).toBeVisible();
  });
});

test("laptop shows the side rail; phone shows the top bar instead", async ({ page }) => {
  await page.goto("/committees");
  const rail = page.getByRole("navigation", { name: "Main" });
  const topbar = page.locator(".topbar");
  if (isPhone()) {
    await expect(rail).toBeHidden();
    await expect(topbar).toBeVisible();
  } else {
    await expect(rail).toBeVisible();
    await expect(topbar).toBeHidden();
  }
});

test("How it's built opens from the shell and from the public pages", async ({ page }) => {
  await page.goto("/committees");
  const link = isPhone()
    ? page.getByRole("link", { name: "How it's built" })
    : page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /How it.s built/ });
  await link.click();
  await expect(page).toHaveURL(/how-its-built$/);
  await expect(page.getByRole("heading", { name: /How it.s built/ })).toBeVisible();
  await page.goto("/");
  await page.getByRole("contentinfo").getByRole("link", { name: /How it.s built/ }).click();
  await expect(page).toHaveURL(/how-its-built$/);
});

test("every page has the iris band and no sideways scroll", async ({ page }) => {
  for (const path of ["/", "/committees", "/how-its-built"]) {
    await page.goto(path);
    await expect(page.locator(".iris")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("the Red Hat fonts are the ones in use", async ({ page }) => {
  await page.goto("/committees");
  const family = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(family).toContain("Red Hat Display");
});
