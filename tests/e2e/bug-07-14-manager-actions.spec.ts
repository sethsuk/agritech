import { test, expect } from "@playwright/test";
import { admin, freshTree, loginAs, th } from "./helpers";

test("bug 14 — reopen a dismissed alert; tabs switch instantly with no gap", async ({ page }) => {
  const treeId = await freshTree();
  await admin.from("alerts").insert({ tier: "tier_2", category: "farm_health", subtype: "pest_moderate", tree_id: treeId });

  await loginAs(page, "manager");
  await page.goto("/alerts");
  const card = page.getByRole("listitem").filter({ hasText: treeId });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: th("dismissAction") }).click();
  await card.getByRole("button", { name: new RegExp(th("confirmAction")) }).click();
  await expect(page.getByText(th("alertDismissedToast"))).toBeVisible();
  await expect(card).toHaveCount(0);

  // Switching tabs is in-memory: no request, and the list renders right under the tabs.
  const apiCalls: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/manager/alerts") && r.method() === "GET") apiCalls.push(r.url()); });
  await page.getByRole("tab", { name: new RegExp(th("statusDismissed")) }).click();
  await expect(card).toBeVisible();
  const tabs = await page.getByRole("tablist").boundingBox();
  const first = await page.getByRole("listitem").first().boundingBox();
  expect(first!.y - (tabs!.y + tabs!.height)).toBeLessThan(40);

  await card.getByRole("button", { name: new RegExp(th("reopenAction")) }).click();
  await expect(page.getByText(th("alertReopenedToast"))).toBeVisible();
  await page.getByRole("tab", { name: new RegExp(th("statusOpen")) }).click();
  await expect(card).toBeVisible();
  expect(apiCalls).toEqual([]);

  const { data } = await admin.from("alerts").select("status, resolution_resolved_at").eq("tree_id", treeId).single();
  expect(data).toEqual({ status: "open", resolution_resolved_at: null });
});

test("bug 7 — deactivated workers are listed separately and can be found again", async ({ page }) => {
  await loginAs(page, "manager");
  await page.goto("/workers");
  await page.getByRole("button", { name: new RegExp(th("filterInactive")) }).click();
  await expect(page).toHaveURL(/inactive=1/);
  await page.getByRole("button", { name: th("filterActive") }).click();
  await expect(page.getByText("U Aung").first()).toBeVisible();
});
