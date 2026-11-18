import type { Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import ws from "ws";
import { dict, type DictKey } from "../../lib/i18n/dictionary";
import { fmt } from "../../lib/i18n/labels";

(globalThis as { WebSocket?: unknown }).WebSocket ??= ws;
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

// Real UI login per test, rather than a shared storageState file: Supabase rotates
// refresh tokens on use, so one browser context's session refresh silently invalidates
// a storageState file still sitting on disk for every other context that loads it
// afterward. Logging in fresh avoids that class of cross-test flakiness entirely.
export const CREDENTIALS = {
  worker1: { username: "worker1", password: "1111", path: /\/scan/ },
  worker2: { username: "worker2", password: "2222", path: /\/scan/ },
  manager: { username: "manager@farm.local", password: "manager1234", path: /\/dashboard/ },
  owner: { username: "owner@farm.local", password: "owner1234", path: /\/dashboard/ },
} as const;

/** UI text in Thai (the default language) straight from the dictionary, so copy edits don't break tests. */
export function th(key: DictKey, vars?: Record<string, string | number>): string {
  return fmt(dict[key].th, vars);
}

/**
 * Pin the UI to Thai (the default) before signing in. Without this, a worker's first
 * sign-in switches the UI to the language their manager set (Burmese for the seeded
 * workers) — correct behaviour, but it would break the Thai text lookups in tests.
 */
export async function pinThai(page: Page) {
  await page.addInitScript(() => {
    try { if (!localStorage.getItem("app_lang")) localStorage.setItem("app_lang", "th"); } catch {}
  });
}

export async function loginWith(page: Page, username: string, password: string, opts: { keepLang?: boolean } = {}) {
  if (!opts.keepLang) await pinThai(page);
  await page.goto("/login");
  await page.getByLabel(th("usernameOrEmailLabel")).fill(username);
  await page.getByLabel(th("passwordLabel")).fill(password);
  await page.getByRole("button", { name: th("loginButton") }).click();
}

export async function loginAs(page: Page, role: keyof typeof CREDENTIALS) {
  const { username, password, path } = CREDENTIALS[role];
  await loginWith(page, username, password);
  await page.waitForURL(path);
}

/** Service-role client for arranging and asserting test data directly. */
export const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * A brand-new tree in the e2e-only zone "Z" (ZL<row>-<col>), so each test starts from
 * a clean tree with no sets/logs. global-teardown deletes every Z tree and its data.
 */
export async function freshTree(): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const row = 1 + Math.floor(Math.random() * 99);
    const col = 1 + Math.floor(Math.random() * 99);
    const treeId = `ZL${row}-${col}`;
    const { error } = await admin.from("trees").insert({
      tree_id: treeId, qr_code: `QR_${treeId}_v1`, lat: 18.75, long: 98.95,
      zone: "Z", side: "L", row_num: row, position: col,
      planted_date: "2020-01-01", variety: "Monthong", status: "active",
    });
    if (!error) return treeId;
  }
  throw new Error("could not allocate a fresh e2e tree");
}

export async function workerId(username: string): Promise<string> {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  const u = data.users.find((x) => x.email === `${username}@farm.local`);
  if (!u) throw new Error(`no user ${username}`);
  return u.id;
}

/** Open a task form for a tree as if its QR had just been scanned. */
export async function openTask(page: Page, treeId: string, taskDefId: string) {
  await page.goto(`/tree/${treeId}`);
  await page.evaluate(([id]) => {
    sessionStorage.setItem("qr_value", `QR_${id}_v1`);
    sessionStorage.setItem("qr_scanned_at", new Date(Date.now() - 60_000).toISOString());
  }, [treeId]);
  await page.goto(`/tree/${treeId}/task/${taskDefId}`);
  await page.getByRole("button", { name: th("submitButton") }).waitFor();
}

/** Submit the open task form and wait for the result toast. */
export async function submitTask(page: Page) {
  await page.getByRole("button", { name: th("submitButton") }).click();
}

/** A task-form field card, found by its (Thai) label. */
export function field(page: Page, label: string) {
  return page.getByRole("group", { name: label });
}

/** Type a number into a NumericCounter inside a field card. */
export async function setNumber(page: Page, label: string, n: number) {
  const card = field(page, label);
  const tap = card.getByRole("button", { name: th("numericTapToSet") });
  if (await tap.isVisible()) await tap.click();
  const input = card.getByRole("spinbutton");
  await input.fill(String(n));
  await input.blur();
}
