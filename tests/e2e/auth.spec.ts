import { test, expect } from "@playwright/test";
import { loginAs, loginWith, th } from "./helpers";

test("shows an error on invalid credentials and stays on /login", async ({ page }) => {
  await loginWith(page, "worker1", "9999");
  await expect(page.getByText(th("loginError"))).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test.describe("root redirect by role", () => {
  test("worker → /scan", async ({ page }) => {
    await loginAs(page, "worker1");
    await page.goto("/");
    await expect(page).toHaveURL(/\/scan/);
  });

  test("manager → /dashboard", async ({ page }) => {
    await loginAs(page, "manager");
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("owner → /dashboard", async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test("a worker visiting /dashboard is bounced to /scan", async ({ page }) => {
  await loginAs(page, "worker1");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/scan/);
});

test("logs out and returns to /login", async ({ page }) => {
  await loginAs(page, "manager");

  await page.getByRole("button", { name: th("logout") }).click();
  await expect(page).toHaveURL(/\/login/);

  // Session is really gone, not just client-side navigation.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("a worker can sign in with a bare username and 4-digit PIN", async ({ page }) => {
  await loginWith(page, "worker1", "1111");
  await expect(page).toHaveURL(/\/scan/);
});
