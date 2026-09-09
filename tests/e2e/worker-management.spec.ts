import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

// e2e_ prefix: matched and deleted by global-teardown.ts after the run.
const username = `e2e_worker_${Date.now()}`;
const displayName = "E2E Test Worker";

test.describe.serial("manager: create, adjust, and deactivate a worker", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "manager");
  });

  test("creates a new worker", async ({ page }) => {
    await page.goto("/workers/new");
    await page.locator('input[placeholder="U Aung"]').fill(displayName);
    await page.locator('input[placeholder="worker4"]').fill(username);
    await page.locator('input[placeholder="1111"]').fill("test1234");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("สร้างบัญชีแล้ว")).toBeVisible();
    await expect(page.getByText(`${username}@farm.local`)).toBeVisible();

    await page.getByRole("link", { name: "ไปที่รายชื่อคนงาน" }).click();
    await expect(page.getByText(displayName)).toBeVisible();
  });

  test("manager sets the new worker's trust tier to trusted", async ({ page }) => {
    await page.goto("/workers");
    await page.locator("table").getByText(displayName).click();
    // Wait for navigation itself before asserting on rendered content — this page's
    // client fetch can be slow under load, separate from the click/render assertions.
    await page.waitForURL(/\/workers\/[^/]+$/);

    await expect(page.getByRole("heading", { name: "ระดับความเชื่อถือ" })).toBeVisible();
    await page.getByRole("button", { name: "เชื่อถือ" }).click();
    await expect(page.getByText("ปรับระดับความเชื่อถือแล้ว")).toBeVisible();
  });

  test("manager deactivates then reactivates the worker", async ({ page }) => {
    await page.goto("/workers");
    await page.locator("table").getByText(displayName).click();
    // Wait for navigation itself before asserting on rendered content — this page's
    // client fetch can be slow under load, separate from the click/render assertions.
    await page.waitForURL(/\/workers\/[^/]+$/);

    await page.getByRole("button", { name: "🚫 ปิดใช้งานคนงานนี้" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "🚫 ปิดใช้งานคนงานนี้" }).click();
    await expect(page.getByText("ปิดใช้งานคนงานแล้ว")).toBeVisible();
    await expect(page.getByText("ปิดใช้งานแล้ว")).toBeVisible();

    await page.getByRole("button", { name: "♻️ เปิดใช้งานอีกครั้ง" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "♻️ เปิดใช้งานอีกครั้ง" }).click();
    await expect(page.getByText("เปิดใช้งานคนงานแล้ว")).toBeVisible();
  });
});
