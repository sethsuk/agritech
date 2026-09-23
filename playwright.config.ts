import { defineConfig } from "@playwright/test";

// @playwright/test is pinned to exactly 1.62.0 in package.json (not ^1.62.0) — 1.63
// dropped install support for Ubuntu 20.04, which this dev environment runs on. Bump
// deliberately, not via a routine `npm install`.
//
// Tests run against a shared dev Supabase project (see CLAUDE.md), not an isolated
// test DB — workers: 1 avoids cross-test races on shared lists (worker/manager tables).
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  // dev:test sets SKIP_VALIDATION=true — required for the worker submission flow,
  // since Playwright has no real GPS/QR match for a seeded tree (see CLAUDE.md).
  webServer: {
    command: "npm run dev:test",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium" }],
});
