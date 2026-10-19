import { defineConfig } from "@playwright/test";

// The auth tests sign in with the test accounts from .env.local (git-ignored). Without it they skip.
try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local: fine on CI */
}

/**
 * System tests drive the production build in a real browser. Every test runs in desktop Chrome. Because Edge is Chromium too, it
 * re-runs only the core flows as a cross-check, and the 375 px phone view runs the layout, touch and accessibility checks (the
 * things a phone can break), so nothing is run three times for no reason. `npm run test:e2e` builds first and runs everything;
 * `npm run test:smoke` runs the short set (tagged @smoke) that is enough after a deploy.
 * Set E2E_BASE_URL to run the same tests against a deployed site, E2E_WORKERS for parallel workers, E2E_RETRIES for retries.
 */
const PORT = 3320;
const remote = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: Number(process.env.E2E_WORKERS ?? 1),
  retries: Number(process.env.E2E_RETRIES ?? 0),
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
    // Signs in once and saves the session; every browser project below waits for it.
    { name: "setup", testMatch: /auth\.setup\.ts/, use: { channel: "msedge" } },
    // The main run: every test.
    { name: "desktop-chrome", testIgnore: /auth\.setup\.ts/, dependencies: ["setup"], use: { channel: "chrome", viewport: { width: 1280, height: 860 } } },
    // A second browser, for the core flows (accounts, committees, members, payments, links, history, privacy, accessibility).
    {
      name: "desktop-edge",
      testIgnore: /auth\.setup\.ts/,
      grep: /(auth|shell|home|committee-create|members|payments|member-link|member-qr|a11y|history|motion-consistency|privacy)\.spec/,
      dependencies: ["setup"],
      use: { channel: "msedge", viewport: { width: 1280, height: 860 } },
    },
    // A 375 px phone: layout and touch checks (anything that "fits" or has no sideways scroll), the shell, and the accessibility scan.
    {
      name: "phone-375",
      testIgnore: /auth\.setup\.ts/,
      grep: /(a11y|shell|home)\.spec|\bfits?\b|width|sideways/i,
      dependencies: ["setup"],
      use: { channel: "msedge", viewport: { width: 375, height: 812 }, hasTouch: true },
    },
  ],
});
