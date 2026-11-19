import { test, expect } from "@playwright/test";
import { admin, freshTree, loginAs, th } from "./helpers";

test.beforeEach(async ({ page }) => { await loginAs(page, "manager"); });

test("bug 10 — 'clear filter' lines up vertically with the filter chips beside it", async ({ page }) => {
  await page.goto("/trees?zone=AL");
  // Zones sit in their own labelled row; "clear" shares the row of the other toggles.
  await expect(page.getByRole("group", { name: th("zoneLabel") }).getByRole("button", { name: "AL", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  const chip = page.getByRole("button", { name: th("retiredBadge"), exact: true });
  const clear = page.getByRole("button", { name: new RegExp(th("clearFilter")) });
  await expect(clear).toBeVisible();
  const a = (await chip.boundingBox())!;
  const b = (await clear.boundingBox())!;
  // Same box height as the chips…
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
  // …and centred on the same line, unless a narrow phone wrapped it to the next row.
  const sameRow = Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < a.height / 2;
  if (sameRow) expect(Math.abs(a.y + a.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(1);
});

test("period and zone filters look different and are labelled", async ({ page }) => {
  await page.goto("/dashboard");
  const period = page.getByRole("group", { name: th("filterRange") });
  const zones = page.getByRole("group", { name: th("zoneLabel") });
  await expect(period.getByRole("button", { name: th("rangeWeek"), exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(zones.getByRole("button", { name: th("filterZoneAll") })).toBeVisible();
  // Period is one joined bar (a bordered container); zones are separate round pills.
  const periodRadius = await period.getByRole("button").first().evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
  const zoneRadius = await zones.getByRole("button").first().evaluate((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius));
  expect(zoneRadius).toBeGreaterThan(periodRadius * 2);
  expect(await period.evaluate((e) => getComputedStyle(e).borderTopWidth)).not.toBe("0px");
  // On a phone the five periods fit on one line rather than wrapping.
  const tops = await period.getByRole("button").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
});

test("bug 11 — a tree in a new zone appears in the zone filters", async ({ page }) => {
  await freshTree(); // zone Z, side L
  await page.goto("/trees");
  await expect(page.getByRole("button", { name: "ZL", exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "ZL", exact: true })).toBeVisible();
});

test("bug 12 — re-capturing the GPS location and saving updates the coordinates", async ({ page, context }) => {
  const treeId = await freshTree();
  await context.setGeolocation({ latitude: 18.8123456, longitude: 99.0123456 });
  await page.goto(`/trees/${treeId}`);

  // The date field used to wipe itself on the first edit, which silently blocked Save.
  // A partial edit (one digit removed) must keep the typed text, not blank the field.
  const date = page.getByLabel(th("plantedDateLabel"));
  await expect(date).toHaveValue("01/01/2020");
  await date.fill("01/01/202");
  await expect(date).toHaveValue("01/01/202");
  await date.fill("01/01/2020");
  await expect(date).toHaveValue("01/01/2020");

  await page.getByRole("button", { name: th("recaptureLocation") }).click();
  await expect(page.getByText("18.812346, 99.012346")).toBeVisible();
  await page.getByRole("button", { name: th("saveEditsButton") }).click();
  await expect(page.getByText(th("savedToast"))).toBeVisible();

  const { data } = await admin.from("trees").select("lat, long").eq("tree_id", treeId).single();
  expect(Number(data!.lat)).toBeCloseTo(18.8123456, 6);
  expect(Number(data!.long)).toBeCloseTo(99.0123456, 6);
});

test("bug 15 — an invalid planted date is called out on the new-tree form", async ({ page }) => {
  await page.goto("/trees/new");
  const date = page.getByLabel(th("plantedDateLabel"));

  await date.pressSequentially("31022020");
  await expect(page.getByRole("alert").filter({ hasText: th("dateNotReal") })).toBeVisible();
  await expect(date).toHaveAttribute("aria-invalid", "true");

  await date.fill("");
  await date.pressSequentially("01012999");
  await expect(page.getByRole("alert").filter({ hasText: th("dateInFuture") })).toBeVisible();

  // A Buddhist-era year is understood: 01/01/2563 = 1 Jan 2020.
  await date.fill("");
  await date.pressSequentially("01012563");
  await expect(date).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(th("dateInFuture"))).toHaveCount(0);
  await expect(page.getByText(th("dateNotReal"))).toHaveCount(0);
});
