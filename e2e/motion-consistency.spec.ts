import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

// One motion vocabulary for everything that appears (rule from Ahmed, 19 Oct): the same curve, duration and entrance, with a
// plain-fade path for reduced motion. Nothing may just pop in.
test.describe("consistent motion (#31)", () => {
  test("the dialog and the confirm box use the app's shared motion, and reduced motion keeps only the fade", async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/members`);

    // The dialog fades and rises on the shared curve and duration (it is not just switched on).
    await page.getByRole("button", { name: "Show QR code for Ali" }).click();
    const dialog = page.getByRole("dialog", { name: "QR code for Ali" });
    await expect(dialog).toBeVisible();
    const motion = await dialog.evaluate((el) => {
      const c = getComputedStyle(el);
      return { property: c.transitionProperty, duration: c.transitionDuration, easing: c.transitionTimingFunction };
    });
    expect(motion.property).toContain("opacity");
    expect(motion.property).toContain("translate");
    expect(motion.duration).toContain("0.3s");
    expect(motion.easing).toContain("cubic-bezier(0.16, 1, 0.3, 1)");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // A confirm box rises in with the same entrance as every other message.
    await page.getByRole("group", { name: "Private link for Ali" }).getByText("Link settings").click();
    await page.getByRole("button", { name: "Make a new link for Ali" }).click();
    const confirm = page.getByRole("group", { name: "Confirm a new link for Ali" });
    await expect(confirm).toBeVisible();
    expect(await confirm.evaluate((el) => getComputedStyle(el).animationName)).toBe("pop-in");

    // Reduced motion: the same entrance stays, but with no travel and no scale.
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--shift").trim())).toBe("0px");
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--pop-scale").trim())).toBe("1");
  });
});
