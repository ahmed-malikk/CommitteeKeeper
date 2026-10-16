import { defineConfig } from "@playwright/test";

/**
 * System tests drive the production build in a real browser, on desktop and on
 * a 375 px phone screen from day one. `npm run test:e2e` builds first.
 * Set E2E_BASE_URL to run the same tests against a deployed site.
 */
const PORT = 3320;
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  // Pages talk to Supabase in Mumbai; from a home connection one round trip can take over a second.
  expect: { timeout: 10_000 },
  use: {
    baseURL: remote ?? `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: remote
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
      },
  projects: [
    { name: "desktop-edge", use: { channel: "msedge", viewport: { width: 1280, height: 860 } } },
    { name: "desktop-chrome", use: { channel: "chrome", viewport: { width: 1280, height: 860 } } },
    { name: "phone-375", use: { channel: "msedge", viewport: { width: 375, height: 812 }, hasTouch: true } },
  ],
});
