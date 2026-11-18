import { test, expect } from "@playwright/test";
import { loginAs, th } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, "manager");
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: th("rangeToday") })).toBeVisible();
  await page.waitForLoadState("networkidle");
});

test("bug 5 — switching time range and zone makes no further API requests", async ({ page }) => {
  const apiCalls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/manager/")) apiCalls.push(r.url()); });

  for (const key of ["rangeToday", "rangeMonth", "rangeYear", "rangeAll", "rangeWeek"] as const) {
    await page.getByRole("button", { name: th(key), exact: true }).click();
    await expect(page.getByRole("button", { name: th(key), exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  await page.getByRole("button", { name: "AL", exact: true }).click();
  await page.getByRole("button", { name: "AR", exact: true }).click();
  await page.getByRole("button", { name: th("filterZoneAll") }).click();

  expect(apiCalls).toEqual([]);
});

test("bug 6 — tapping ⓘ explains 'trees not checked' and 'sets past harvest window'", async ({ page }) => {
  await page.getByRole("button", { name: new RegExp(`${th("moreInfo")}: ต้นที่ไม่ได้ตรวจ`) }).click();
  await expect(page.locator("[data-infotip-panel]")).toContainText("ไม่มีใครบันทึกงาน");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-infotip-panel]")).toHaveCount(0);

  await page.getByRole("button", { name: `${th("moreInfo")}: ${th("statOverdueSets")}` }).click();
  await expect(page.locator("[data-infotip-panel]")).toContainText("ช่วงเก็บเกี่ยว");
});

test("bug 16 — the Logs and Fruit tiles open the Logs page on the same slice", async ({ page }) => {
  await page.getByRole("button", { name: th("rangeMonth"), exact: true }).click();
  await expect(page).toHaveURL(/range=month/);
  await page.getByRole("main").getByRole("link", { name: new RegExp(`^${th("statLogsLabel")} \\d`) }).click();
  await expect(page).toHaveURL(/\/logs\?range=month/);
  await expect(page.getByRole("heading", { name: new RegExp(th("logsTitle")) })).toBeVisible();

  await page.goBack();
  await page.getByRole("main").getByRole("link", { name: new RegExp(`^${th("statFruitHarvested")}`) }).click();
  await expect(page).toHaveURL(/\/logs\?range=month.*task=harvest/);
  await expect(page.getByLabel(th("filterTask"), { exact: true })).toHaveValue("harvest");
});
