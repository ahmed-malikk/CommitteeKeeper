import { expect, test } from "@playwright/test";

// The daily job's front door, checked as an API (no browser page). TC-043 to TC-045.
// Locally CRON_SECRET comes from .env.local; on a deployed site the tests can't know it, so only the refusals run there.
const secret = process.env.CRON_SECRET ?? "";
const remote = Boolean(process.env.E2E_BASE_URL);

test.describe("the daily job (US-16)", () => {
  test("is refused without its secret, and with a wrong one (TC-043)", { tag: "@smoke" }, async ({ request }) => {
    const none = await request.get("/api/cron/daily");
    expect([401, 503]).toContain(none.status());
    if (secret) expect(none.status()).toBe(401);
    expect(JSON.stringify(await none.json())).not.toMatch(/ran/);

    const wrong = await request.get("/api/cron/daily", { headers: { authorization: "Bearer not-the-secret" } });
    expect([401, 503]).toContain(wrong.status());
    if (secret) expect(wrong.status()).toBe(401);
  });

  test("with the secret it runs, or says plainly that the server key is not set up; and running it again changes nothing (TC-044, TC-045)", async ({ request }) => {
    test.skip(!secret || remote, "needs CRON_SECRET in .env.local and a local server");
    const first = await request.get("/api/cron/daily", { headers: { authorization: `Bearer ${secret}` } });
    expect([200, 503]).toContain(first.status());
    const body = await first.json();
    if (first.status() === 503) {
      expect(body.error).toMatch(/server key is not set up/);
      return;
    }
    expect(body.ran).toBe(true);
    const second = await request.get("/api/cron/daily", { headers: { authorization: `Bearer ${secret}` } });
    const again = await second.json();
    expect(second.status()).toBe(200);
    expect(again.emailed).toBe(0);
    expect(again.logged).toBe(0);
  });
});
