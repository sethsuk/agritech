import { test, expect } from "@playwright/test";
import { randomUUID } from "crypto";
import {
  admin, createE2EWorker, field, freshTree, loginAs, loginWith, openTask, rpcSubmit, submitTask, th, workerId,
} from "./helpers";
import { signToken } from "../../lib/logToken";

/** Fixes for the independent review's findings (H1, M3–M6, deactivation, PIN reset, failed sets). */

test("H1 — the same submission sent twice saves one log", async ({ page }) => {
  const treeId = await freshTree();
  await loginAs(page, "worker1");
  const start = await page.request.post("/api/start-log", {
    data: { treeId, taskDefId: "watering_v1", qrScannedAt: new Date().toISOString() },
  });
  const { logToken } = await start.json();
  const body = { logToken, qrValue: `QR_${treeId}_v1`, gpsLat: null, gpsLong: null, formData: { duration_minutes: 10 }, photoUrl: null };
  const first = await (await page.request.post("/api/submit-log", { data: body })).json();
  const retry = await page.request.post("/api/submit-log", { data: body }); // e.g. the response was lost
  expect(retry.ok()).toBe(true);
  expect((await retry.json()).logId).toBe(first.logId);
  const { count } = await admin.from("task_logs").select("*", { count: "exact", head: true }).eq("tree_id", treeId);
  expect(count).toBe(1);
});

test("M3 — renewing an expired token keeps the original form-open time", async ({ page }) => {
  const treeId = await freshTree();
  const w = await workerId("worker1");
  const opened = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const expired = signToken({
    workerId: w, treeId, taskDefId: "watering_v1", photoRequired: false, photoRequirementReason: "none",
    auditSeed: "", formOpenedAt: opened, qrScannedAt: opened, submissionId: randomUUID(),
    expiresAt: new Date(Date.now() - 3_600_000).toISOString(),
  });
  await loginAs(page, "worker1");
  const res = await (await page.request.post("/api/start-log", {
    data: { treeId, taskDefId: "watering_v1", qrScannedAt: new Date().toISOString(), previousToken: expired },
  })).json();
  expect(res.renewed).toBe(true);
  expect(res.formOpenedAt).toBe(opened);

  // A token for a different task is not renewable — a fresh form starts.
  const other = await (await page.request.post("/api/start-log", {
    data: { treeId, taskDefId: "fertilizer_application_v1", qrScannedAt: new Date().toISOString(), previousToken: expired },
  })).json();
  expect(other.renewed).toBe(false);
});

test("M4 — a lower-case typed tree ID is stored as the canonical ID", async ({ page }) => {
  const treeId = await freshTree();
  await loginAs(page, "worker1");
  await page.goto("/scan");
  await page.getByLabel(th("treeIdLabel")).fill(treeId.toLowerCase());
  await page.getByRole("button", { name: th("scanSearch") }).click();
  await expect(page).toHaveURL(new RegExp(`/tree/${treeId}`));
  expect(await page.evaluate(() => sessionStorage.getItem("qr_value"))).toBe(treeId);
});

test("M5 — a last pick with no fruit closes the set", async ({ page }) => {
  const treeId = await freshTree();
  const bloom = await rpcSubmit(treeId, await workerId("worker1"), "bloom_log", "bloom_log_v1", { color: "blue", flower_count: 8 });
  await loginAs(page, "worker1");
  await openTask(page, treeId, "harvest_log_v1");
  await field(page, "เลือกชุด (สีเชือก)").getByRole("radio").first().click();
  await field(page, "เก็บครั้งสุดท้ายของชุดนี้").getByRole("radio", { name: new RegExp(th("yesLabel")) }).click();
  await submitTask(page);
  await expect(page.getByText(th("savedBannerTitle"))).toBeVisible();
  const { data } = await admin.from("set_state").select("close_reason, lost").eq("set_id", bloom.set_id).single();
  expect(data).toEqual({ close_reason: "final_pick", lost: 8 });
});

test("M6 — after logout, the next user never sees the previous user's records", async ({ page }) => {
  const treeId = await freshTree();
  await rpcSubmit(treeId, await workerId("worker1"), "watering", "watering_v1", { duration_minutes: 5 });
  await loginAs(page, "worker1");
  await page.goto("/my-logs");
  await expect(page.locator("main li a").filter({ hasText: treeId }).first()).toBeVisible();

  await page.getByRole("button", { name: th("myLogsTitle") }).or(page.getByRole("button", { name: th("back") })).first().click();
  await page.getByRole("button", { name: th("logout") }).click();
  await expect(page).toHaveURL(/\/login/);
  await loginAs(page, "worker2");
  await page.goto("/my-logs");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main li a").filter({ hasText: treeId })).toHaveCount(0);
});

test("deactivation takes effect at once, and a PIN reset works", async ({ page, browser }) => {
  const w = await createE2EWorker("4321");
  // The worker is signed in on their phone…
  const phone = await browser.newPage();
  await loginWith(phone, w.username, "4321");
  await expect(phone).toHaveURL(/\/scan/);

  // …the manager resets the PIN, then deactivates them.
  await loginAs(page, "manager");
  await page.goto(`/workers/${w.id}`);
  await page.getByLabel(th("newPinLabel")).fill("8642");
  await page.getByRole("button", { name: th("resetPinButton") }).click();
  await expect(page.getByText(th("pinResetToast"))).toBeVisible();
  await page.getByRole("button", { name: th("deactivateWorkerButton") }).click();
  await page.getByRole("dialog").getByRole("button", { name: th("deactivateWorkerButton") }).click();
  await expect(page.getByText(th("deactivatedWorkerToast"))).toBeVisible();

  // The existing session is refused on its next request: 401 if Supabase already rejects
  // the banned session, 403 (account_inactive) from our gate otherwise.
  const res = await phone.request.post("/api/start-log", {
    data: { treeId: "AL1-1", taskDefId: "watering_v1", qrScannedAt: new Date().toISOString() },
  });
  expect([401, 403]).toContain(res.status());
  await phone.close();

  // Reactivate: the NEW PIN works.
  await page.getByRole("button", { name: th("reactivateWorkerButton") }).click();
  await page.getByRole("dialog").getByRole("button", { name: th("reactivateWorkerButton") }).click();
  await expect(page.getByText(th("reactivatedWorkerToast"))).toBeVisible();
  const fresh = await browser.newPage();
  await loginWith(fresh, w.username, "8642");
  await expect(fresh).toHaveURL(/\/scan/);
  await fresh.close();
});

test("a manager can close a set as failed, and reopen it", async ({ page }) => {
  const treeId = await freshTree();
  const bloom = await rpcSubmit(treeId, await workerId("worker1"), "bloom_log", "bloom_log_v1", { color: "white", flower_count: 12 });
  await loginAs(page, "manager");
  await page.goto(`/trees/${treeId}`);
  await page.getByRole("button", { name: th("closeSetFailed") }).click();
  await page.getByRole("dialog").getByRole("button", { name: th("closeSetFailed") }).click();
  await expect(page.getByText(th("setClosedFailedToast"))).toBeVisible();
  expect((await admin.from("sets").select("close_reason").eq("set_id", bloom.set_id).single()).data?.close_reason).toBe("failed");

  await page.getByRole("button", { name: new RegExp(th("reopenSet")) }).click();
  await expect(page.getByText(th("setReopenedToast"))).toBeVisible();
  expect((await admin.from("sets").select("closed_at").eq("set_id", bloom.set_id).single()).data?.closed_at).toBeNull();
});
