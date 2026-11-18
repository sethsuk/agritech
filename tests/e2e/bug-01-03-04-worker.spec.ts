import { test, expect } from "@playwright/test";
import { admin, freshTree, loginAs, openTask, setNumber, submitTask, th } from "./helpers";
import { formatDateTime } from "../../lib/time";

test.describe("worker screens", () => {
  let treeId: string;
  test.beforeAll(async () => { treeId = await freshTree(); });
  test.beforeEach(async ({ page }) => { await loginAs(page, "worker1"); });

  // Bug 1: a phone set to US Eastern time must still see Bangkok time.
  test.describe("in a non-Thai device timezone", () => {
    test.use({ timezoneId: "America/New_York" });

    test("bug 1 — log times are shown in Bangkok time", async ({ page }) => {
      await openTask(page, treeId, "watering_v1");
      await setNumber(page, "ระยะเวลา (นาที)", 10);
      await submitTask(page);
      await expect(page).toHaveURL(new RegExp(`/tree/${treeId}$`));

      const { data } = await admin.from("task_logs").select("submitted_at").eq("tree_id", treeId)
        .order("submitted_at", { ascending: false }).limit(1).single();
      const expected = formatDateTime(data!.submitted_at, "th"); // Bangkok, Buddhist year

      await page.goto("/my-logs");
      await expect(page.locator("main li a").filter({ hasText: treeId }).first()).toContainText(expected);
    });
  });

  test("bug 3 — task buttons show only the translated name, no raw codes", async ({ page }) => {
    await page.goto(`/tree/${treeId}`);
    await expect(page.getByRole("link", { name: /รดน้ำ/ })).toBeVisible();
    const text = await page.locator("main").innerText();
    for (const code of ["bloom_log", "fertilizer", "harvest", "pest_inspection", "soil_check", "watering", "fruit_check"]) {
      expect(text).not.toContain(code);
    }
    // And in English, English names — still no codes.
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("link", { name: /Watering/ })).toBeVisible();
    expect(await page.locator("main").innerText()).not.toMatch(/\b[a-z]+_[a-z]+\b/);
  });

  test("bug 4 — the correction reason is visibly marked required and explains itself", async ({ page }) => {
    // Self-contained: its own log, so it doesn't depend on another test having run.
    await openTask(page, treeId, "watering_v1");
    await setNumber(page, "ระยะเวลา (นาที)", 5);
    await submitTask(page);
    await expect(page).toHaveURL(new RegExp(`/tree/${treeId}$`));
    await page.goto("/my-logs");
    await page.locator("main li a").filter({ hasText: treeId }).first().click();
    await page.getByRole("button", { name: th("correctButton") }).click();

    const label = page.locator('label[for="reason"]');
    await expect(label).toContainText("*");
    await page.getByRole("button", { name: th("saveCorrectionButton") }).click();
    await expect(page.getByRole("alert").filter({ hasText: th("reasonRequiredError") })).toBeVisible();
    await expect(page.locator("#reason")).toBeFocused();
  });
});
