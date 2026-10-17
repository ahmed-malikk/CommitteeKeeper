import { expect, test } from "@playwright/test";
import { EMPTY_STATE, ORGANISER_STATE } from "./helpers";

test.use({ storageState: ORGANISER_STATE });

const isPhone = () => test.info().project.name === "phone-375";

test.describe("motion", () => {
  test.describe("on a new account (empty state)", () => {
    test.use({ storageState: EMPTY_STATE });
    test("words pop in and everything has settled visible a moment later", async ({ page }) => {
    await page.goto("/committees");
    const word = page.locator(".pw").first();
    await expect(word).toHaveCSS("animation-name", "pop");
    await expect.poll(() => word.evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
    // the iris band has finished drawing across (no clip left) and the rosette rings are fully drawn
    await expect.poll(() => page.locator(".iris").evaluate((el) => getComputedStyle(el).clipPath), { timeout: 4000 }).toMatch(/^inset\((0(px|%)?\s?)+\)$/);
    await expect.poll(() => page.locator(".empty svg.big ellipse").first().evaluate((el) => getComputedStyle(el).strokeDashoffset), { timeout: 5000 }).toBe("0px");
    });
  });

  test("the rail highlight sits on the active link and is set up to slide", async ({ page }) => {
    test.skip(isPhone(), "the rail is a laptop feature");
    await page.goto("/committees");
    const pill = page.locator(".rail .pill");
    await expect(pill).toHaveCSS("opacity", "1");
    const link = page.locator(".rail a.nav.on");
    const expected = await link.evaluate((el: HTMLElement) => ({ y: el.offsetTop, h: el.offsetHeight }));
    expect(await pill.evaluate((el) => el.style.transform)).toBe(`translateY(${expected.y}px)`);
    expect(await pill.evaluate((el) => el.style.height)).toBe(`${expected.h}px`);
    await expect(page.locator(".rail")).toHaveAttribute("data-slide", "on");
    await expect(pill).toHaveCSS("transition-property", /transform/);
  });

  test("the page is readable with scripts off (motion is CSS, nothing is hidden for good)", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "CommitteeKeeper" })).toBeVisible();
    await expect.poll(() => page.locator(".pw").first().evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
    await context.close();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce", storageState: EMPTY_STATE });

  test("words fade instead of travelling, and loops are off", async ({ page }) => {
    await page.goto("/committees");
    await expect(page.locator(".pw").first()).toHaveCSS("animation-name", "fade-only");
    await expect(page.locator(".empty svg.big .spin")).toHaveCSS("animation-name", "none");
    await expect(page.locator(".empty svg.big ellipse").first()).toHaveCSS("stroke-dashoffset", "0px");
    const shift = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--shift").trim());
    expect(shift).toBe("0px");
  });

  test("the page is fully visible almost at once", async ({ page }) => {
    await page.goto("/committees");
    await expect.poll(() => page.locator(".pw").first().evaluate((el) => getComputedStyle(el).opacity), { timeout: 1500 }).toBe("1");
  });
});
