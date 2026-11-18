import { test, expect } from "@playwright/test";
import { loginAs, loginWith, th } from "./helpers";

// e2e_ prefix: matched and deleted by global-teardown.ts after the run.
const username = `e2e_worker_${Date.now()}`;
const displayName = "E2E Test Worker";

test.describe.serial("manager: create, adjust, and deactivate a worker", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "manager");
  });

  test("creates a new worker", async ({ page }) => {
    await page.goto("/workers/new");
    await page.locator("#new-worker-name").fill(displayName);
    await page.locator("#new-worker-username").fill(username);
    // A 4-digit PIN — this exact case used to fail with a 500 (Supabase's 6-char minimum).
    await page.locator("#new-worker-pin").fill("4321");
    await page.getByRole("button", { name: th("createAccountButton") }).click();

    await expect(page.getByText(th("accountCreatedTitle"))).toBeVisible();
    await expect(page.getByText(username, { exact: true })).toBeVisible();

    await page.getByRole("link", { name: th("goToWorkersList") }).click();
    await expect(page.getByText(displayName)).toBeVisible();
  });

  test("the new worker can sign in with their 4-digit PIN", async ({ page }) => {
    await page.context().clearCookies();
    await loginWith(page, username, "4321");
    await expect(page).toHaveURL(/\/scan/);
  });

  test("manager sets the new worker's trust tier to trusted", async ({ page }) => {
    await page.goto("/workers");
    await page.locator("table").getByText(displayName).click();
    // Wait for navigation itself before asserting on rendered content — this page's
    // client fetch can be slow under load, separate from the click/render assertions.
    await page.waitForURL(/\/workers\/[^/]+$/);

    await expect(page.getByRole("heading", { name: th("trustTierLabel") })).toBeVisible();
    await page.getByRole("button", { name: th("tierTrusted"), exact: true }).click();
    await expect(page.getByText(th("trustTierUpdatedToast"))).toBeVisible();
  });

  test("manager deactivates then reactivates the worker", async ({ page }) => {
    await page.goto("/workers");
    await page.locator("table").getByText(displayName).click();
    // Wait for navigation itself before asserting on rendered content — this page's
    // client fetch can be slow under load, separate from the click/render assertions.
    await page.waitForURL(/\/workers\/[^/]+$/);

    await page.getByRole("button", { name: th("deactivateWorkerButton") }).click();
    await page.getByRole("dialog").getByRole("button", { name: th("deactivateWorkerButton") }).click();
    await expect(page.getByText(th("deactivatedWorkerToast"))).toBeVisible();
    await expect(page.getByText(th("inactiveBadge"))).toBeVisible();

    await page.getByRole("button", { name: th("reactivateWorkerButton") }).click();
    await page.getByRole("dialog").getByRole("button", { name: th("reactivateWorkerButton") }).click();
    await expect(page.getByText(th("reactivatedWorkerToast"))).toBeVisible();
  });
});
