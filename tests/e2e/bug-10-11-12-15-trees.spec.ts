import { test, expect } from "@playwright/test";
import { admin, freshTree, loginAs, th } from "./helpers";

test.beforeEach(async ({ page }) => { await loginAs(page, "manager"); });

test("bug 10 — 'clear filter' lines up vertically with the zone chips", async ({ page }) => {
  await page.goto("/trees?zone=AL");
  const chip = page.getByRole("button", { name: "AL", exact: true });
  const clear = page.getByRole("button", { name: new RegExp(th("clearFilter")) });
  await expect(clear).toBeVisible();
  const a = (await chip.boundingBox())!;
  const b = (await clear.boundingBox())!;
  // Same box height as the chips…
  expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
  // …and centred on whichever chip shares its row (on a narrow phone it may wrap).
  const centers = await page.getByRole("group", { name: th("zoneLabel") }).getByRole("button").evaluateAll(
    (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent ?? "", c: r.top + r.height / 2 }; }),
  );
  const mine = b.y + b.height / 2;
  const sameRow = centers.filter((x) => !x.text.includes("✕") && Math.abs(x.c - mine) < a.height / 2);
  for (const x of sameRow) expect(Math.abs(x.c - mine)).toBeLessThanOrEqual(1);
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
