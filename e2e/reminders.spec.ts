import { expect, test } from "@playwright/test";
import { ORGANISER_STATE, hasLogin, organiserDb, runningByHand } from "./helpers";

test.use({ storageState: ORGANISER_STATE });
test.skip(!hasLogin, "needs the test login");

// A committee that began in January 2026 with 2 periods, nothing recorded: every instalment is long late.
test.describe("daily summary and WhatsApp messages (US-16)", () => {
  test("the Reminders tab lists who is late, with one prepared message each and no other member's name (FR-14)", async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/reminders`);
    await expect(page.getByRole("heading", { name: /^Late/ })).toBeVisible();
    const late = page.getByRole("region", { name: /^Late/ });
    await expect(late.locator(".li")).toHaveCount(4);
    // Each line carries its own prepared message, which names its own member and nobody else.
    const first = late.locator(".li").first();
    await expect(first.locator(".msg")).toContainText(/Assalam o Alaikum .*Rs 1,000.*days? late/);
    const text = await first.locator(".msg").innerText();
    expect(text.includes("Ali") !== text.includes("مریم")).toBe(true);
    // No phone saved yet, so the way to send it is to copy it.
    await expect(first.getByRole("button", { name: /Copy the message for/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Due today/ })).toBeVisible();
  });

  test("with a phone number saved, the message is an ordinary WhatsApp link with the text filled in (FR-14, TC-046)", async ({ page }) => {
    test.setTimeout(300_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    const committeeId = url.split("/").pop() as string;
    const db = await organiserDb();
    const members = await db.from("members").select("id, name").eq("committee_id", committeeId);
    const ali = members.data!.find((m) => m.name === "Ali")!;
    const saved = await db.rpc("update_member", { p_committee_id: committeeId, p_member_id: ali.id, p_name: "Ali", p_phone: "0300 1234567" });
    expect(saved.error).toBeNull();

    await page.goto(`${url}/reminders`);
    const link = page.getByRole("link", { name: "Send the reminder to Ali on WhatsApp" }).first();
    const href = (await link.getAttribute("href")) as string;
    expect(href).toMatch(/^https:\/\/wa\.me\/923001234567\?text=/);
    const decoded = decodeURIComponent(href.split("text=")[1]);
    expect(decoded).toContain("Assalam o Alaikum Ali");
    expect(decoded).toContain("Rs 1,000");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
  });

  test("the Reminders tab fits the width, with Urdu-script names", async ({ page }) => {
    test.setTimeout(240_000);
    const { url } = await runningByHand(page, ["Ali", "مریم خان"]);
    await page.goto(`${url}/reminders`);
    await expect(page.getByText("مریم خان").first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
