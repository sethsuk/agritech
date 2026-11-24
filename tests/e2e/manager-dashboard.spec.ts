import { test, expect } from "@playwright/test";
import { admin, freshTree, loginAs, rpcSubmit, th, workerId } from "./helpers";

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

test("a log's detail page opens and names the worker who logged it", async ({ page }) => {
  // The worker's name used to be joined as users:worker_id(…), which PostgREST rejects
  // (task_logs.worker_id points at workers, not users); the route ignored the error and
  // every log detail page showed "couldn't load".
  const treeId = await freshTree();
  const wid = await workerId("worker1");
  const { log_id } = await rpcSubmit(treeId, wid, "watering", "watering_v1", { duration_minutes: 5 });
  const { data: u } = await admin.from("users").select("display_name").eq("id", wid).single();

  await page.goto(`/logs/${log_id}`);
  await expect(page.getByRole("link", { name: treeId, exact: true })).toBeVisible();
  await expect(page.getByText(th("submittedByLabel"))).toBeVisible();
  await expect(page.getByRole("link", { name: u!.display_name, exact: true })).toHaveAttribute("href", `/workers/${wid}`);
});
