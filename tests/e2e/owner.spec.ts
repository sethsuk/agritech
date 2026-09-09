import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// e2e_ prefix: matched and deleted by global-teardown.ts after the run.
const username = `e2e_manager_${Date.now()}`;
const displayName = "E2E Test Manager";
const password = "test1234";

test.describe("manager cannot reach owner-only pages", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "manager");
  });

  test("no Managers nav link, and /managers redirects away", async ({ page }) => {
    await expect(page.getByRole("link", { name: "ผู้จัดการ" })).toHaveCount(0);

    await page.goto("/managers");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe.serial("owner: create, view, and remove a manager", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "owner");
  });

  test("owner sees the Managers nav link and the existing manager", async ({ page }) => {
    await page.getByRole("link", { name: "ผู้จัดการ" }).click();
    await expect(page).toHaveURL(/\/managers/);
    await expect(page.getByText("manager@farm.local")).toBeVisible();
  });

  test("creates a new manager", async ({ page }) => {
    await page.goto("/managers/new");
    await page.locator('input[type="text"]').first().fill(displayName);
    await page.locator('input[placeholder="manager2"]').fill(username);
    await page.locator('input[type="text"]').nth(2).fill(password);
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("สร้างบัญชีแล้ว")).toBeVisible();
    await expect(page.getByText(`${username}@farm.local`)).toBeVisible();

    await page.getByRole("link", { name: "ไปที่รายชื่อผู้จัดการ" }).click();
    await expect(page.getByText(displayName)).toBeVisible();
  });

  test("the new manager can log in", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(`${username}@farm.local`);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("owner deactivates the new manager", async ({ page }) => {
    await page.goto("/managers");
    const row = page.getByTestId("manager-row").filter({ hasText: displayName });
    await row.getByRole("button", { name: "🚫 ปิดใช้งานผู้จัดการนี้" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "🚫 ปิดใช้งานผู้จัดการนี้" }).click();

    await expect(page.getByText("ปิดใช้งานผู้จัดการแล้ว")).toBeVisible();
  });

  test("the deactivated manager can no longer log in", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(`${username}@farm.local`);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("owner reactivates the manager", async ({ page }) => {
    await page.goto("/managers");
    const row = page.getByTestId("manager-row").filter({ hasText: displayName });
    await row.getByRole("button", { name: "♻️ เปิดใช้งานอีกครั้ง" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "♻️ เปิดใช้งานอีกครั้ง" }).click();

    await expect(page.getByText("เปิดใช้งานผู้จัดการแล้ว")).toBeVisible();
  });
});
