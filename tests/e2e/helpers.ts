import type { Page } from "@playwright/test";

// Real UI login per test, rather than a shared storageState file: Supabase rotates
// refresh tokens on use, so one browser context's session refresh silently invalidates
// a storageState file still sitting on disk for every other context that loads it
// afterward. Logging in fresh avoids that class of cross-test flakiness entirely.
export const CREDENTIALS = {
  worker1: { email: "worker1@farm.local", password: "1111", path: /\/scan/ },
  manager: { email: "manager@farm.local", password: "manager1234", path: /\/dashboard/ },
  owner: { email: "owner@farm.local", password: "owner1234", path: /\/dashboard/ },
} as const;

export async function loginAs(page: Page, role: keyof typeof CREDENTIALS) {
  const { email, password, path } = CREDENTIALS[role];
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(path);
}
