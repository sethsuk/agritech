import { test, expect } from "@playwright/test";
import { admin, field, freshTree, loginAs, openTask, setNumber, submitTask, th } from "./helpers";

/**
 * Bug 2 — harvests must be a subset of the bloom log, with flower loss accounted for.
 * Walks one set through its whole life on a fresh tree, on a phone.
 */
test.describe.serial("bloom → fruit count → harvest lifecycle", () => {
  let treeId: string;

  test.beforeAll(async () => { treeId = await freshTree(); });
  test.beforeEach(async ({ page }) => { await loginAs(page, "worker1"); });

  const openSet = async () => {
    const { data } = await admin.from("set_state").select("*").eq("tree_id", treeId).is("closed_at", null).maybeSingle();
    return data;
  };

  test("harvest and fruit count are unavailable before any bloom is logged", async ({ page }) => {
    await page.goto(`/tree/${treeId}`);
    await expect(page.getByText(th("needsOpenSet")).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /บันทึกการเก็บเกี่ยว/ })).toHaveCount(0);
  });

  test("log a red-ribbon bloom with 30 flowers", async ({ page }) => {
    await openTask(page, treeId, "bloom_log_v1");
    await field(page, "สีเชือก").getByRole("radio", { name: /แดง/ }).click();
    await setNumber(page, "จำนวนดอก", 30);
    await submitTask(page);
    await expect(page).toHaveURL(new RegExp(`/tree/${treeId}(\\?saved=1)?$`));
    await expect(page.getByText(th("setRemaining", { n: 30 }))).toBeVisible();
  });

  test("a second red bloom is blocked while the red set is open", async ({ page }) => {
    await openTask(page, treeId, "bloom_log_v1");
    await expect(field(page, "สีเชือก").getByRole("radio", { name: /แดง/ })).toBeDisabled();
  });

  test("a fruit count higher than what's left is rejected, naming the limit", async ({ page }) => {
    await openTask(page, treeId, "fruit_count_v1");
    await field(page, "เลือกชุด (สีเชือก)").getByRole("radio").first().click();
    await setNumber(page, "จำนวนผลที่เหลือบนต้น", 31);
    await submitTask(page);
    await expect(page.getByRole("alert").filter({ hasText: "30" })).toBeVisible();
    await expect(page).toHaveURL(/fruit_count_v1/);
  });

  test("a fruit count of 12 records that 18 flowers never set fruit", async ({ page }) => {
    await openTask(page, treeId, "fruit_count_v1");
    await field(page, "เลือกชุด (สีเชือก)").getByRole("radio").first().click();
    await setNumber(page, "จำนวนผลที่เหลือบนต้น", 12);
    await submitTask(page);
    await expect(page.getByText(th("setRemaining", { n: 12 }))).toBeVisible();
  });

  test("harvesting 7 leaves 5", async ({ page }) => {
    await openTask(page, treeId, "harvest_log_v1");
    await field(page, "เลือกชุด (สีเชือก)").getByRole("radio").first().click();
    const grades = field(page, "จำนวนผลตามเกรด");
    await grades.getByRole("spinbutton", { name: "A" }).fill("5");
    await grades.getByRole("spinbutton", { name: "B" }).fill("2");
    await grades.getByRole("spinbutton", { name: "B" }).blur();
    await submitTask(page);
    await expect(page.getByText(th("setRemaining", { n: 5 }))).toBeVisible();
  });

  test("over-harvesting is saved but flagged, alerts the manager, and closes the set", async ({ page }) => {
    await openTask(page, treeId, "harvest_log_v1");
    await field(page, "เลือกชุด (สีเชือก)").getByRole("radio").first().click();
    const a = field(page, "จำนวนผลตามเกรด").getByRole("spinbutton", { name: "A" });
    await a.fill("9");
    await a.blur();
    await submitTask(page);
    await expect(page.getByText(th("submitFlagged"))).toBeVisible();

    expect(await openSet()).toBeNull();
    const { data: alerts } = await admin.from("alerts").select("subtype, status").eq("tree_id", treeId);
    expect(alerts).toContainEqual({ subtype: "harvest_exceeds_set", status: "open" });
  });

  test("voiding the over-harvest reopens the set with 5 left again", async ({ page }) => {
    await page.goto("/my-logs");
    await page.locator("main li a").filter({ hasText: treeId }).first().click();
    await page.getByRole("button", { name: th("voidButton") }).click();
    await page.getByLabel(th("voidReasonLabel")).fill("e2e: miscounted");
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(th("voidSuccessToast"))).toBeVisible();

    const set = await openSet();
    expect(set?.remaining).toBe(5);
    const { data: alerts } = await admin.from("alerts").select("subtype, status").eq("tree_id", treeId);
    expect(alerts).toContainEqual({ subtype: "harvest_exceeds_set", status: "dismissed" });
  });

  test("the last pick closes the set and counts the rest as lost", async ({ page }) => {
    await openTask(page, treeId, "harvest_log_v1");
    await field(page, "เลือกชุด (สีเชือก)").getByRole("radio").first().click();
    const a = field(page, "จำนวนผลตามเกรด").getByRole("spinbutton", { name: "A" });
    await a.fill("3");
    await a.blur();
    await field(page, "เก็บครั้งสุดท้ายของชุดนี้").getByRole("radio", { name: new RegExp(th("yesLabel")) }).click();
    await submitTask(page);
    await expect(page).toHaveURL(new RegExp(`/tree/${treeId}(\\?saved=1)?$`));

    const { data: set } = await admin.from("set_state").select("*").eq("tree_id", treeId).single();
    expect(set.close_reason).toBe("final_pick");
    expect(set.harvested_total).toBe(10);
    expect(set.lost).toBe(20);
    // Red is free again for the next bloom wave.
    await openTask(page, treeId, "bloom_log_v1");
    await expect(field(page, "สีเชือก").getByRole("radio", { name: /แดง/ })).toBeEnabled();
  });
});
