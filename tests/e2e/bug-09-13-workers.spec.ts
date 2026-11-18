import { test, expect } from "@playwright/test";
import { admin, freshTree, loginAs, openTask, setNumber, submitTask, th, workerId } from "./helpers";

test("bug 9 — a worker's new log shows up in the manager's workers view", async ({ page }) => {
  const id = await workerId("worker2");
  const { data: before } = await admin.from("worker_stats").select("logs_total").eq("worker_id", id).single();
  const treeId = await freshTree();

  await loginAs(page, "worker2");
  await openTask(page, treeId, "watering_v1");
  await setNumber(page, "ระยะเวลา (นาที)", 15);
  await submitTask(page);
  await expect(page).toHaveURL(new RegExp(`/tree/${treeId}$`));

  await page.context().clearCookies();
  await loginAs(page, "manager");
  await page.goto(`/workers/${id}`);
  await expect(page.getByRole("heading", { name: "Daw Khin" })).toBeVisible();
  const allTime = page.locator("div").filter({ hasText: new RegExp(`^${th("reliabilityAllTime")}`) }).first();
  await expect(allTime).toContainText(String(before!.logs_total + 1));
});

test("bug 13 — worker metrics use plain names with explanations", async ({ page }) => {
  await loginAs(page, "manager");
  await page.goto("/workers");
  await expect(page.getByText(th("flagRatePrefix")).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("แฟลก")).toHaveCount(0);

  await page.getByRole("link", { name: /U Aung/ }).click();
  await page.getByRole("button", { name: new RegExp(th("moreInfo")) }).filter({ visible: true }).first().click();
  await expect(page.getByRole("tooltip")).toContainText("ระบบตั้งข้อสังเกต");
});
