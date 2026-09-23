import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

const TREE_ID = "AL5-5";

test.describe.serial("worker submission, correction, and void flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "worker1");
  });

  test("scan → pick watering task → submit", async ({ page }) => {
    await page.goto("/scan");
    await page.locator('input[placeholder="A-001"]').fill(TREE_ID);
    await page.getByRole("button", { name: "ค้นหา" }).click();

    await expect(page).toHaveURL(new RegExp(`/tree/${TREE_ID}`));
    await page.getByText("รดน้ำ").click();

    await expect(page).toHaveURL(new RegExp(`/tree/${TREE_ID}/task/watering_v1`));
    await page.getByRole("button", { name: "+", exact: true }).click();
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("บันทึกข้อมูลเรียบร้อย")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/tree/${TREE_ID}$`));
  });

  test("submitted log appears in my-logs with the right value", async ({ page }) => {
    await page.goto("/my-logs");
    const firstEntry = page.locator("main button").first();
    await expect(firstEntry).toContainText("รดน้ำ");
    await expect(firstEntry).toContainText(TREE_ID);
    await firstEntry.click();

    await expect(page).toHaveURL(/\/my-logs\/.+/);
    await expect(page.getByText("duration_minutes")).toBeVisible();
    await expect(page.getByText("5", { exact: true })).toBeVisible();
  });

  test("correcting the log updates the value and shows a corrected badge", async ({ page }) => {
    await page.goto("/my-logs");
    await page.locator("main button").first().click();

    await page.getByRole("button", { name: "✏️ แก้ไขบันทึกนี้" }).click();
    await page.getByRole("button", { name: "+", exact: true }).click();
    await page.locator("textarea").fill("e2e correction test");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("แก้ไขบันทึกเรียบร้อย")).toBeVisible();
    await expect(page.getByText("10", { exact: true })).toBeVisible();

    await page.goto("/my-logs");
    await expect(page.locator("main button").first()).toContainText("แก้ไขแล้ว");
  });

  test("voiding the log shows a voided badge and hides the action buttons", async ({ page }) => {
    await page.goto("/my-logs");
    await page.locator("main button").first().click();

    await page.getByRole("button", { name: "🗑️ ยกเลิกบันทึกนี้" }).click();
    // Reason is required.
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("กรุณาระบุเหตุผล")).toBeVisible();

    await page.locator("textarea").fill("e2e void test");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText("ยกเลิกบันทึกเรียบร้อย")).toBeVisible();
    await expect(page.getByRole("button", { name: "✏️ แก้ไขบันทึกนี้" })).toHaveCount(0);

    await page.goto("/my-logs");
    await expect(page.locator("main button").first()).toContainText("ยกเลิกแล้ว");
  });
});
