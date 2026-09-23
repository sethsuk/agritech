import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test("shows an error on invalid credentials and stays on /login", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("worker1@farm.local");
  await page.locator('input[type="password"]').fill("wrong-password");
  await page.locator('button[type="submit"]').click();

  await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
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

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();
  await expect(page).toHaveURL(/\/login/);

  // Session is really gone, not just client-side navigation.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
