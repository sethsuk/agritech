import { test, expect } from "@playwright/test";
import { field, freshTree, loginAs, openTask, setNumber, submitTask, th } from "./helpers";

/** Phase 3 usability fixes (Nielsen heuristics), on a phone. */
test.describe("worker usability", () => {
  let treeId: string;
  test.beforeAll(async () => { treeId = await freshTree(); });
  test.beforeEach(async ({ page }) => { await loginAs(page, "worker1"); });

  test("entries survive leaving the form and are restored, with a way to start over", async ({ page }) => {
    await openTask(page, treeId, "pest_inspection_v1");
    const moderate = field(page, "ความรุนแรง").getByRole("radio", { name: /ปานกลาง/ });
    await moderate.click();
    await expect(moderate).toHaveAttribute("aria-checked", "true");

    await page.goto(`/tree/${treeId}`); // e.g. an accidental Back / app switch
    await openTask(page, treeId, "pest_inspection_v1");
    await expect(page.getByText(th("draftRestored"))).toBeVisible();
    await expect(field(page, "ความรุนแรง").getByRole("radio", { name: /ปานกลาง/ })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: th("discardDraft") }).click();
    await expect(field(page, "ความรุนแรง").getByRole("radio", { name: /ปานกลาง/ })).toHaveAttribute("aria-checked", "false");
  });

  test("after saving, the next step — scanning the next tree — is one tap", async ({ page }) => {
    await openTask(page, treeId, "watering_v1");
    await setNumber(page, "ระยะเวลา (นาที)", 20);
    await submitTask(page);
    await expect(page.getByText(th("savedBannerTitle"))).toBeVisible();
    await page.getByRole("button", { name: th("scanNextTree") }).click();
    await expect(page).toHaveURL(/\/scan/);
  });

  test("a submitted form isn't reopened by Back", async ({ page }) => {
    await openTask(page, treeId, "watering_v1");
    await setNumber(page, "ระยะเวลา (นาที)", 25);
    await submitTask(page);
    await expect(page).toHaveURL(new RegExp(`/tree/${treeId}\\?saved=1$`));
    await page.goBack();
    await expect(page).not.toHaveURL(/\/task\//);
  });

  test("unknown pages show a translated not-found screen with a way home", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: th("notFoundTitle") })).toBeVisible();
    await page.getByRole("link", { name: th("goHome") }).click();
    await expect(page).toHaveURL(/\/scan/);
  });

  test("pinch-zoom is allowed (no maximum-scale / user-scalable=no)", async ({ page }) => {
    await page.goto("/scan");
    const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
    expect(viewport).not.toMatch(/maximum-scale|user-scalable=no/);
    expect(viewport).toContain("viewport-fit=cover");
  });
});
