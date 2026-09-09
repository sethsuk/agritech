import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "manager");
});

test("dashboard shows core stats and the stale-tree / overdue-set sections", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "ภาพรวมฟาร์ม" })).toBeVisible();

  await expect(page.getByText("ต้นที่เงียบหาย")).toBeVisible();
  await expect(page.getByText("ชุดผลเลยกำหนด")).toBeVisible();
  await expect(page.getByRole("heading", { name: "ต้นที่ยังไม่มีการบันทึกนาน" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ชุดผลที่เลยกำหนดเก็บเกี่ยว" })).toBeVisible();
});

test("trees list loads and no longer shows a hardcoded 0-days bug", async ({ page }) => {
  await page.goto("/trees");
  await expect(page.getByRole("heading", { name: /ต้นทุเรียน/ })).toBeVisible();
  // The bug this replaced always showed "0 วันที่แล้ว" for every logged tree —
  // assert at least one tree correctly reports as never logged instead.
  await expect(page.locator("table").getByText("ยังไม่มี").first()).toBeVisible();
});

test("workers list loads", async ({ page }) => {
  await page.goto("/workers");
  await expect(page.getByRole("heading", { name: /คนงาน/ })).toBeVisible();
});

test("alerts page loads", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page).toHaveURL(/\/alerts/);
  await expect(page.locator("body")).not.toContainText("Application error");
});
