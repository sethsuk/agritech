import { test, expect } from "@playwright/test";
import { loginAs, th } from "./helpers";

const TREE_ID = "AL5-5";

test.describe.serial("worker submission, correction, and void flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "worker1");
  });

  test("scan → pick watering task → submit", async ({ page }) => {
    await page.goto("/scan");
    await page.getByLabel(th("treeIdLabel")).fill(TREE_ID);
    await page.getByRole("button", { name: th("scanSearch") }).click();

    await expect(page).toHaveURL(new RegExp(`/tree/${TREE_ID}`));
    await page.getByRole("link", { name: /รดน้ำ/ }).click();

    await expect(page).toHaveURL(new RegExp(`/tree/${TREE_ID}/task/watering_v1`));
    await page.getByRole("button", { name: /^\+\d/ }).click();
    await page.getByRole("button", { name: th("submitButton") }).click();

    await expect(page.getByText(th("savedBannerTitle")).or(page.getByText(th("submitFlagged")).first())).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/tree/${TREE_ID}(\\?saved=1)?$`));
  });

  test("submitted log appears in my-logs with the right value", async ({ page }) => {
    await page.goto("/my-logs");
    const firstEntry = page.locator("main li a").first();
    await expect(firstEntry).toContainText("รดน้ำ");
    await expect(firstEntry).toContainText(TREE_ID);
    await firstEntry.click();

    await expect(page).toHaveURL(/\/my-logs\/.+/);
    // Field label in the worker's language — the raw key "duration_minutes" used to show.
    await expect(page.getByText("ระยะเวลา (นาที)")).toBeVisible();
    await expect(page.getByText("duration_minutes")).toHaveCount(0);
    await expect(page.getByText("5", { exact: true })).toBeVisible();
  });

  test("correcting the log updates the value and shows a corrected badge", async ({ page }) => {
    await page.goto("/my-logs");
    await page.locator("main li a").first().click();

    await page.getByRole("button", { name: th("correctButton") }).click();
    await page.getByRole("button", { name: /^\+\d/ }).click();
    await page.getByLabel(th("correctReasonLabel")).fill("e2e correction test");
    await page.getByRole("button", { name: th("saveCorrectionButton") }).click();

    await expect(page.getByText(th("correctionSuccessToast"))).toBeVisible();
    await expect(page.getByText("10", { exact: true })).toBeVisible();

    await page.goto("/my-logs");
    await expect(page.locator("main li a").first()).toContainText(th("correctedBadge"));
  });

  test("voiding the log shows a voided badge and hides the action buttons", async ({ page }) => {
    await page.goto("/my-logs");
    await page.locator("main li a").first().click();

    await page.getByRole("button", { name: th("voidButton") }).click();
    // Reason is required — shown inline, not just as a toast.
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole("alert").filter({ hasText: th("reasonRequiredError") })).toBeVisible();

    await page.getByLabel(th("voidReasonLabel")).fill("e2e void test");
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(th("voidSuccessToast"))).toBeVisible();
    await expect(page.getByRole("button", { name: th("correctButton") })).toHaveCount(0);

    await page.goto("/my-logs");
    await expect(page.locator("main li a").first()).toContainText(th("voidedBadge"));
  });
});
