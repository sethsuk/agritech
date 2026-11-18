import { test, expect } from "@playwright/test";
import { loginAs, th } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "manager");
});

test("dashboard shows core stats and the stale-tree / overdue-set sections", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: th("dashboardTitle") })).toBeVisible();
  await expect(page.getByText(th("statOverdueSets")).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: th("overdueSetsTitle") })).toBeVisible();
  await expect(page.getByRole("heading", { name: /ต้นที่ไม่ได้ตรวจ/ })).toBeVisible();
});

test("trees list loads every tree and reports never-logged trees", async ({ page }) => {
  await page.goto("/trees");
  await expect(page.getByRole("heading", { name: /ต้นทุเรียน/ })).toBeVisible();
  await expect(page.locator("table").getByText(th("neverLoggedYet")).first()).toBeVisible();
});

test("workers list loads", async ({ page }) => {
  await page.goto("/workers");
  await expect(page.getByRole("heading", { name: new RegExp(th("navWorkers")) })).toBeVisible();
});

test("alerts page loads", async ({ page }) => {
  await page.goto("/alerts");
  await expect(page).toHaveURL(/\/alerts/);
  await expect(page.locator("body")).not.toContainText("Application error");
});
