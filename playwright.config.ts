import { defineConfig, devices } from "@playwright/test";

// @playwright/test is pinned to exactly 1.62.0 in package.json (not ^1.62.0) — 1.63
// dropped install support for Ubuntu 20.04, which one dev environment runs on. Bump
// deliberately, not via a routine `npm install`.
//
// Tests run against a shared dev Supabase project (see CLAUDE.md), not an isolated
// test DB — workers: 1 avoids cross-test races on shared lists. Each bug spec creates
// its own tree in the e2e-only zone "Z"; global-teardown removes them.
//
// The app is mobile-first, so the bug specs run on phone emulation: Pixel 7 (Chromium)
// and iPhone 14 (WebKit). The older specs target the desktop manager layout (tables).
const GEO = { latitude: 18.75, longitude: 98.95 };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    geolocation: GEO,
    permissions: ["geolocation"],
    timezoneId: "Asia/Bangkok",
  },
  // dev:test sets SKIP_VALIDATION=true — presence/timing checks can't pass without a
  // real phone at a real tree. Field/bounds checks still run (see lib/validation).
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    // testMatch/testIgnore are matched against the full path, so exclude by filename suffix.
    { name: "desktop", testIgnore: /\/bug-[^/]*\.spec\.ts$/, use: { ...devices["Desktop Chrome"] } },
    { name: "pixel", testMatch: /\/bug-[^/]*\.spec\.ts$/, use: { ...devices["Pixel 7"] } },
    { name: "iphone", testMatch: /\/bug-[^/]*\.spec\.ts$/, use: { ...devices["iPhone 14"] } },
  ],
});
