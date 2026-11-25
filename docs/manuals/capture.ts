/**
 * Captures every screenshot used by the user manuals.
 *
 *   1. Build and start the app in test mode (a production build, not `next dev`: in dev,
 *      React Strict Mode stops the QR camera from starting, and dev pages are slow):
 *        npm run build
 *        LOG_TOKEN_SECRET=<any 32+ chars> SKIP_VALIDATION=true npx next start -p 3000
 *   2. Run:                           npx tsx docs/manuals/capture.ts   [th|my|manager]
 *   3. Then build the PDFs:           npx tsx docs/manuals/build.ts
 *
 * Writes to the shared dev Supabase project, like the e2e suite does. Demo data follows
 * the e2e throwaway conventions (trees in zone "Z", accounts prefixed `e2e_`), but the
 * cleanup here removes ONLY the exact trees and accounts listed in DEMO_TREES /
 * DEMO_USERS — never other zone-Z or e2e_ data, which may belong to someone's test run.
 * Set KEEP_DATA=1 to leave the demo data in place after the run.
 *
 * For each screenshot it also records the on-screen boxes of the elements the manual
 * points at (marks.json), so build.ts can draw numbered markers on top of them.
 */
import { chromium, type Browser, type Locator, type Page, type Route } from "@playwright/test";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import ws from "ws";
import { dict, type DictKey } from "../../lib/i18n/dictionary";
import { fmt } from "../../lib/i18n/labels";
import { toAuthPassword } from "../../lib/auth/pin";
import { Client } from "pg";

(globalThis as { WebSocket?: unknown }).WebSocket ??= ws;
config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const BASE = "http://localhost:3000";
const ROOT = resolve(process.cwd(), "docs/manuals/screenshots");
const GEO = { latitude: 18.75, longitude: 98.95 };
const PIN = "1234";
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

type Lang = "th" | "my";
type Box = { x: number; y: number; w: number; h: number };
type Marks = Record<string, Record<string, Box>>;

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const DEMO_TREES = ["ZL1-1", "ZL1-2", "ZL2-1", "ZL2-2", "ZR3-1", "ZR3-2", "ZR3-3", "ZL9-9"];
const DEMO_USERS = ["e2e_manual_th", "e2e_manual_my", "e2e_manual_x", "minzaw"];

/** "minzaw" is a plain name (it appears on screen) — refuse to run if a real one exists. */
async function assertMinzawIsOurs() {
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const u = data.users.find((x) => x.email === "minzaw@farm.local");
  if (!u) return;
  const { data: row } = await admin.from("users").select("display_name").eq("id", u.id).maybeSingle();
  if (row?.display_name !== "มินโซ") {
    throw new Error("A real account 'minzaw' exists — rename the demo username in capture.ts before running.");
  }
}

/** Remove exactly the demo trees/accounts above, and everything hanging off them. */
async function cleanup() {
  await assertMinzawIsOurs();
  const emails = DEMO_USERS.map((u) => `${u}@farm.local`);
  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    await pg.query("BEGIN");
    const scope = `(tree_id = ANY($1) OR worker_id IN (SELECT id FROM auth.users WHERE email = ANY($2)))`;
    const args = [DEMO_TREES, emails];
    await pg.query(`DELETE FROM public.alerts WHERE ${scope}`, args);
    await pg.query(`UPDATE public.task_logs SET set_id = NULL WHERE ${scope}`, args);
    await pg.query(`DELETE FROM public.sets WHERE tree_id = ANY($1) OR bloom_log_id IN (SELECT log_id FROM public.task_logs WHERE ${scope})`, args);
    await pg.query(`DELETE FROM public.task_logs WHERE correction_of_log_id IS NOT NULL AND ${scope}`, args);
    await pg.query(`DELETE FROM public.task_logs WHERE ${scope}`, args);
    await pg.query(`DELETE FROM public.trees WHERE tree_id = ANY($1)`, [DEMO_TREES]);
    await pg.query(`SELECT public.rollup_rebuild()`); // direct deletes bypass the rollup-maintaining RPCs
    await pg.query("COMMIT");
  } catch (e) {
    await pg.query("ROLLBACK");
    throw e;
  } finally {
    await pg.end();
  }
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((x) => x.email && emails.includes(x.email))) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    if (error) console.error(`  could not delete ${u.email}: ${error.message}`);
  }
}

async function createWorker(username: string, displayName: string, language: Lang, trust = "standard") {
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@farm.local`, password: toAuthPassword(PIN), email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser ${username}: ${error?.message}`);
  const id = data.user.id;
  await must(admin.from("users").insert({ id, role: "worker", display_name: displayName }));
  await must(admin.from("workers").insert({ worker_id: id, language, assigned_zones: ["A", "Z"], trust_tier: trust }));
  return id;
}

async function createTree(treeId: string) {
  const m = /^Z([LR])(\d+)-(\d+)$/.exec(treeId)!;
  await must(admin.from("trees").insert({
    tree_id: treeId, qr_code: `QR_${treeId}_v1`, lat: GEO.latitude, long: GEO.longitude,
    zone: "Z", side: m[1], row_num: Number(m[2]), position: Number(m[3]),
    planted_date: "2018-06-01", variety: "Monthong", status: "active",
  }));
}

/** Arrange a log directly through the same RPC submit-log uses. */
async function rpcLog(treeId: string, workerId: string, taskType: string, taskDefId: string, form: object,
  opts: { minutesAgo?: number; flags?: string[]; gpsDelta?: number } = {}) {
  const at = new Date(Date.now() - (opts.minutesAgo ?? 0) * 60_000);
  const opened = new Date(at.getTime() - 45_000).toISOString();
  const { data, error } = await admin.rpc("submit_task_log", {
    p: {
      tree_id: treeId, task_def_id: taskDefId, task_type: taskType, worker_id: workerId,
      submitted_at: at.toISOString(), form_opened_at: opened, qr_scanned_at: opened, qr_value: `QR_${treeId}_v1`,
      gps_lat: GEO.latitude, gps_long: GEO.longitude, gps_delta_meters: opts.gpsDelta ?? 3,
      validation_status: opts.flags?.length ? "flagged" : "passed", validation_flags: opts.flags ?? [], form_data: form,
    },
  });
  if (error) throw new Error(`rpc ${taskDefId}: ${error.message}`);
  return data as { log_id: string; set_id: string };
}

async function must<T extends { error: { message: string } | null }>(p: PromiseLike<T>): Promise<T> {
  const r = await p;
  if (r.error) throw new Error(r.error.message);
  return r;
}

// ---------------------------------------------------------------------------
// Screenshot helpers
// ---------------------------------------------------------------------------

class Shooter {
  marks: Marks = {};
  constructor(readonly dir: string, readonly lang: Lang | "th") { mkdirSync(dir, { recursive: true }); }

  ui(key: DictKey, vars?: Record<string, string | number>) {
    return fmt(dict[key][this.lang], vars);
  }

  /** Viewport screenshot (what the phone actually shows) + marker boxes. */
  async shot(page: Page, name: string, targets: Record<string, Locator> = {}, opts: { settle?: number } = {}) {
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(opts.settle ?? 400);
    const boxes: Record<string, Box> = {};
    for (const [label, loc] of Object.entries(targets)) {
      const b = await loc.first().boundingBox().catch(() => null);
      if (b) boxes[label] = { x: b.x, y: b.y, w: b.width, h: b.height };
      else console.warn(`  ! ${name}: marker ${label} not found`);
    }
    await page.screenshot({ path: resolve(this.dir, `${name}.png`) });
    this.marks[name] = boxes;
    console.log(`  ✓ ${name}`);
  }

  save() {
    writeFileSync(resolve(this.dir, "marks.json"), JSON.stringify(this.marks, null, 2));
  }
}

let lastPage: Page | null = null;

/**
 * A stand-in phone camera: getUserMedia returns a canvas stream. It shows an empty
 * orchard-green frame until the script sets window.__qr to a data URL, then a printed
 * tree label with that QR code — which html5-qrcode genuinely decodes.
 */
// A string, not a function: tsx wraps named functions in a __name() helper that
// doesn't exist in the page, which would make the script throw before installing.
const FAKE_CAMERA = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 640; canvas.height = 640;
  const g = canvas.getContext("2d");
  let img = null;
  setInterval(() => {
    const grad = g.createLinearGradient(0, 0, 0, 640);
    grad.addColorStop(0, "#3d5a2a"); grad.addColorStop(1, "#22331a");
    g.fillStyle = grad; g.fillRect(0, 0, 640, 640);
    g.fillStyle = "#5b4630"; g.fillRect(250, 0, 140, 640);
    if (window.__qr) {
      if (!img || img.src !== window.__qr) { img = new Image(); img.src = window.__qr; }
      g.fillStyle = "#ffffff"; g.fillRect(170, 150, 300, 340);
      if (img.complete) g.drawImage(img, 185, 165, 270, 270);
    }
  }, 100);
  const stream = canvas.captureStream(10);
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => stream;
})();`;

function hideDevBadge() {
  document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style");
    s.textContent = "nextjs-portal{display:none!important}";
    document.head.appendChild(s);
  });
}

async function phone(browser: Browser, lang: Lang | "th", extra: Parameters<Browser["newContext"]>[0] & { noCamera?: boolean } = {}) {
  const { noCamera, ...ctxOpts } = extra;
  const ctx = await browser.newContext({
    ...PHONE, baseURL: BASE, locale: lang === "my" ? "my-MM" : "th-TH", timezoneId: "Asia/Bangkok",
    geolocation: { ...GEO, accuracy: 4 }, permissions: ["geolocation", "camera"], ...ctxOpts,
  });
  await ctx.addInitScript((l) => {
    try { localStorage.setItem("app_lang", l); } catch {}
  }, lang);
  await ctx.addInitScript(hideDevBadge);
  if (!noCamera) await ctx.addInitScript({ content: FAKE_CAMERA });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000); // dev mode compiles each route on first visit
  page.on("dialog", (d) => d.accept()); // beforeunload on dirty forms
  lastPage = page;
  return { ctx, page };
}

async function login(page: Page, s: Shooter, username: string, password: string, url: RegExp) {
  await page.goto("/login");
  await page.getByLabel(s.ui("usernameOrEmailLabel")).fill(username);
  await page.getByLabel(s.ui("passwordLabel")).fill(password);
  await page.getByRole("button", { name: s.ui("loginButton") }).click();
  await page.waitForURL(url);
}

const field = (page: Page, id: string) => page.locator(`#field-${id}`);

async function setNum(page: Page, s: Shooter, id: string, n: number) {
  const f = field(page, id);
  const input = f.locator("input[type=number]");
  if (!(await input.isVisible())) await f.getByRole("button", { name: s.ui("numericTapToSet") }).click();
  await input.fill(String(n));
  await input.blur();
}

const pick = (page: Page, id: string, index: number) => field(page, id).locator("button").nth(index).click();

/** Submit a form the server is expected to refuse, and wait for its answer. */
async function submitRejected(page: Page, s: Shooter) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/submit-log")),
    page.getByRole("button", { name: s.ui("submitButton"), exact: true }).click(),
  ]);
  await page.getByRole("button", { name: s.ui("submitButton"), exact: true }).waitFor();
}

/** Open a task from the tree screen (by URL — clicking right after a save races a re-render). */
async function openTask(page: Page, s: Shooter, taskDefId: string) {
  const tree = /\/tree\/([^/?]+)/.exec(page.url())![1];
  await page.goto(`/tree/${tree}/task/${taskDefId}`);
  await page.getByRole("button", { name: s.ui("submitButton"), exact: true }).waitFor();
  await page.waitForTimeout(600);
}

async function submit(page: Page, s: Shooter) {
  await page.getByRole("button", { name: s.ui("submitButton"), exact: true }).click();
  // Leave the form first — the previous submit's ?saved=1 URL would match immediately.
  await page.waitForURL((u) => !u.pathname.includes("/task/") && u.search === "?saved=1");
  await page.getByText(s.ui("chooseTask")).waitFor();
}

const taskName = (lang: Lang, id: string) => TASKS[id][lang];
const TASKS: Record<string, Record<Lang, string>> = {
  watering_v1: { th: "รดน้ำ", my: "ရေလောင်းခြင်း" },
  fertilizer_application_v1: { th: "ใส่ปุ๋ย", my: "မြေဩဇာထည့်ခြင်း" },
  bloom_log_v1: { th: "บันทึกการออกดอก", my: "ပန်းပွင့်မှတ်တမ်း" },
  pest_inspection_v1: { th: "ตรวจหาศัตรูพืช", my: "ပိုးမွှားစစ်ဆေးခြင်း" },
  soil_acidity_check_v1: { th: "ตรวจค่ากรดดิน", my: "မြေဆီလွှာစစ်ဆေးခြင်း" },
  fruit_count_v1: { th: "นับผลที่ติด", my: "အသီးအရေအတွက် စစ်ဆေးခြင်း" },
  harvest_log_v1: { th: "บันทึกการเก็บเกี่ยว", my: "ရိတ်သိမ်းမှတ်တမ်း" },
};

const toast = (page: Page) => page.locator("[data-sonner-toast]").first();

// ---------------------------------------------------------------------------
// Worker manual
// ---------------------------------------------------------------------------

async function workerScreens(browser: Browser, lang: Lang, username: string, treeA: string, treeB: string) {
  console.log(`worker (${lang})`);
  const s = new Shooter(resolve(ROOT, `worker-${lang}`), lang);
  const { ctx, page } = await phone(browser, lang);
  const T = (id: string) => taskName(lang, id);

  // --- Sign in ---
  await page.goto("/login");
  await page.getByLabel(s.ui("usernameOrEmailLabel")).fill("worker1");
  await page.getByLabel(s.ui("passwordLabel")).fill("1111");
  await s.shot(page, "login", {
    lang: page.locator("main > div > div").first(),
    user: page.getByLabel(s.ui("usernameOrEmailLabel")),
    pin: page.getByLabel(s.ui("passwordLabel")),
    go: page.getByRole("button", { name: s.ui("loginButton") }),
  });

  // A username that doesn't exist — the error is the same, and no test account shows.
  await page.getByLabel(s.ui("usernameOrEmailLabel")).fill("worker9");
  await page.getByLabel(s.ui("passwordLabel")).fill("0000");
  await page.getByRole("button", { name: s.ui("loginButton") }).click();
  await page.getByText(s.ui("loginError")).waitFor();
  await s.shot(page, "login-error", { err: page.getByText(s.ui("loginError")) });

  await page.getByLabel(s.ui("usernameOrEmailLabel")).fill(username);
  await page.getByLabel(s.ui("passwordLabel")).fill(PIN);
  await page.getByRole("button", { name: s.ui("loginButton") }).click();
  await page.waitForURL(/\/scan/);

  // --- Home / scan ---
  const region = page.locator("#qr-scanner-region");
  await region.locator("video").waitFor();
  await s.shot(page, "scan", {
    records: page.getByRole("link", { name: s.ui("myLogsNavLabel") }),
    camera: region,
    typed: page.getByLabel(s.ui("treeIdLabel")),
    lang: page.locator("header > div").nth(1),
    logout: page.getByRole("button", { name: s.ui("logout") }),
  }, { settle: 1500 });

  // A real scan: hold the tree lookup so the "looking up tree" moment can be captured.
  let held: Route | null = null;
  await page.route("**/api/trees/**", (r) => { held = r; });
  const qr = await QRCode.toDataURL(`QR_${treeA}_v1`, { margin: 2, width: 400 });
  await page.evaluate((d) => { (window as unknown as { __qr: string }).__qr = d; }, qr);
  await page.getByText(s.ui("scanning")).waitFor();
  await s.shot(page, "scan-qr", { camera: region, looking: page.getByText(s.ui("scanning")) });
  await (held as Route | null)?.continue();
  await page.unroute("**/api/trees/**");
  await page.waitForURL(new RegExp(`/tree/${treeA}$`));
  await page.getByText(s.ui("chooseTask")).waitFor();
  await s.shot(page, "tree", {
    info: page.locator("main > div").first(),
    tasks: page.getByText(s.ui("chooseTask")),
    back: page.getByRole("button", { name: s.ui("back") }),
  });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // locked tasks + exit button
  await s.shot(page, "tree-locked", {
    locked: page.locator("[aria-disabled]").first(),
    exit: page.getByRole("button", { name: s.ui("exitTree") }),
  });

  // Typed ID
  await page.goto("/scan");
  await region.locator("video").waitFor();
  await page.getByLabel(s.ui("treeIdLabel")).fill(treeA);
  await page.getByLabel(s.ui("treeIdLabel")).scrollIntoViewIfNeeded();
  await s.shot(page, "scan-typed", {
    typed: page.getByLabel(s.ui("treeIdLabel")),
    search: page.getByRole("button", { name: s.ui("scanSearch") }),
    notice: page.getByText(s.ui("manualEntryNotice")),
  });

  // Unknown tree
  await page.getByLabel(s.ui("treeIdLabel")).fill("AX99-99");
  await page.getByRole("button", { name: s.ui("scanSearch") }).click();
  await toast(page).waitFor();
  await s.shot(page, "tree-not-found", { toast: toast(page) }, { settle: 200 });
  await page.waitForTimeout(3500);

  // Back to the tree by typed ID
  await page.getByLabel(s.ui("treeIdLabel")).fill(treeA);
  await page.getByRole("button", { name: s.ui("scanSearch") }).click();
  await page.waitForURL(new RegExp(`/tree/${treeA}$`));
  await page.getByText(s.ui("chooseTask")).waitFor();

  // --- Watering: the walkthrough task ---
  await openTask(page, s, "watering_v1");
  await s.shot(page, "form-empty", {
    gps: page.getByText(s.ui("gpsFound", { m: 0 }).split("(")[0].trim()),
    field: field(page, "duration_minutes"),
    photo: page.getByText(s.ui("photoOptionalNotice")),
    submit: page.getByRole("button", { name: s.ui("submitButton"), exact: true }),
  });
  await setNum(page, s, "duration_minutes", 30);
  await s.shot(page, "form-filled", {
    minus: field(page, "duration_minutes").locator("button").first(),
    value: field(page, "duration_minutes").locator("input[type=number]"),
    plus: field(page, "duration_minutes").locator("button").last(),
    submit: page.getByRole("button", { name: s.ui("submitButton"), exact: true }),
  });
  await submit(page, s);
  await page.getByText(s.ui("savedBannerTitle")).first().waitFor();
  await s.shot(page, "saved", {
    banner: page.getByRole("status"),
    next: page.getByRole("button", { name: s.ui("scanNextTree") }),
  });

  // --- Required-field error ---
  await openTask(page, s, "fertilizer_application_v1");
  await page.getByRole("button", { name: s.ui("submitButton"), exact: true }).click();
  await field(page, "fertilizer_type").locator("[role=alert]").waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot(page, "err-required", { err: field(page, "fertilizer_type").locator("[role=alert]") });

  // Fertilizer (filled)
  await pick(page, "fertilizer_type", 0);
  await setNum(page, s, "amount_kg", 2.5);
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot(page, "task-fertilizer", {
    type: field(page, "fertilizer_type"),
    amount: field(page, "amount_kg"),
  });

  // Typing past the limit (50 kg): the counter refuses it and keeps the last good value
  await setNum(page, s, "amount_kg", 80);
  await field(page, "amount_kg").locator("[role=alert]").last().waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot(page, "err-too-big", {
    value: field(page, "amount_kg").locator("input[type=number]"),
    err: field(page, "amount_kg").locator("[role=alert]").last(),
  });
  await submit(page, s);

  // --- Leave a half-filled form: confirm dialog ---
  await openTask(page, s, "pest_inspection_v1");
  await pick(page, "severity", 1);
  await page.getByRole("button", { name: s.ui("back") }).click();
  await page.getByText(s.ui("exitFormConfirm")).waitFor();
  await s.shot(page, "exit-confirm", {
    discard: page.getByRole("button", { name: s.ui("exitFormDiscard") }),
    cancel: page.getByRole("button", { name: s.ui("cancelAction") }),
  });
  await page.getByRole("button", { name: s.ui("cancelAction") }).click();

  // Pest inspection (filled, moderate)
  await pick(page, "severity", 2);
  await s.shot(page, "task-pest", { sev: field(page, "severity") });
  await submit(page, s);

  // --- Draft restored after the page was closed ---
  await openTask(page, s, "soil_acidity_check_v1");
  await setNum(page, s, "moisture_pct", 40);
  await page.reload();
  await page.getByText(s.ui("draftRestored")).waitFor();
  await s.shot(page, "draft-restored", {
    banner: page.getByText(s.ui("draftRestored")),
    discard: page.getByRole("button", { name: s.ui("discardDraft") }),
  });
  await setNum(page, s, "ph", 6.4);
  await s.shot(page, "task-soil", { ph: field(page, "ph"), moist: field(page, "moisture_pct") });
  await submit(page, s);

  // --- Bloom: creates a fruit set ---
  await openTask(page, s, "bloom_log_v1");
  await pick(page, "color", 0);
  await setNum(page, s, "flower_count", 120);
  await s.shot(page, "task-bloom", { color: field(page, "color"), count: field(page, "flower_count") });
  await submit(page, s);
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot(page, "tree-with-set", { set: page.getByText(s.ui("activeSets")).locator("..") });

  // A colour already open on this tree is greyed out
  await openTask(page, s, "bloom_log_v1");
  await pick(page, "color", 1);
  await setNum(page, s, "flower_count", 40);
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot(page, "bloom-color-used", {
    used: field(page, "color").locator("button").first(),
    picked: field(page, "color").locator("button").nth(1),
  });
  await submit(page, s);

  // --- Fruit count ---
  await openTask(page, s, "fruit_count_v1");
  await pick(page, "set_id", 0);
  await setNum(page, s, "fruit_count", 150);
  await submitRejected(page, s);
  await field(page, "fruit_count").locator("[role=alert]").last().waitFor();
  await s.shot(page, "err-fruit-count", { err: field(page, "fruit_count").locator("[role=alert]").last() });
  await setNum(page, s, "fruit_count", 85);
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot(page, "task-fruit-count", { set: field(page, "set_id"), count: field(page, "fruit_count") });
  await submit(page, s);

  // --- Harvest ---
  await openTask(page, s, "harvest_log_v1");
  await pick(page, "set_id", 0);
  const grades = field(page, "grade_counts").locator("input[type=number]");
  await grades.nth(0).fill("12"); await grades.nth(1).fill("6"); await grades.nth(2).fill("2"); await grades.nth(3).fill("1");
  await grades.nth(3).blur();
  await page.evaluate(() => window.scrollTo(0, 0));
  await s.shot(page, "task-harvest", { set: field(page, "set_id"), grades: field(page, "grade_counts") });
  await field(page, "final_pick").scrollIntoViewIfNeeded();
  await s.shot(page, "task-harvest-final", { final: field(page, "final_pick") });
  await submit(page, s);

  // --- My records ---
  await page.goto("/my-logs");
  await page.locator("main li a").first().waitFor();
  await s.shot(page, "records", { first: page.locator("main li a").first() });

  // Correct the watering record
  await page.locator("main li a", { hasText: T("watering_v1") }).first().click();
  await page.getByRole("button", { name: s.ui("correctButton") }).waitFor();
  await s.shot(page, "record-detail", {
    correct: page.getByRole("button", { name: s.ui("correctButton") }),
    void: page.getByRole("button", { name: s.ui("voidButton") }),
  });
  await page.getByRole("button", { name: s.ui("correctButton") }).click();
  await setNum(page, s, "duration_minutes", 45);
  await page.locator("#reason").fill(lang === "th" ? "กรอกเวลาผิด" : "အချိန် မှားရိုက်မိသည်");
  await s.shot(page, "record-correct", {
    value: field(page, "duration_minutes"),
    reason: page.locator("#reason"),
    save: page.getByRole("button", { name: s.ui("saveCorrectionButton") }),
  });
  await page.getByRole("button", { name: s.ui("saveCorrectionButton") }).click();
  await toast(page).waitFor();
  await page.waitForTimeout(3500);

  // Void the fertilizer record
  await page.goto("/my-logs");
  await page.locator("main li a", { hasText: T("fertilizer_application_v1") }).first().click();
  await page.getByRole("button", { name: s.ui("voidButton") }).click();
  await page.locator("#reason").fill(lang === "th" ? "บันทึกผิดต้น" : "ပင်မှား၍ မှတ်မိသည်");
  await s.shot(page, "record-void", {
    warn: page.getByText(s.ui("voidConfirmTitle")),
    reason: page.locator("#reason"),
    go: page.getByRole("button", { name: s.ui("voidButton") }),
  });
  await page.getByRole("button", { name: s.ui("voidButton") }).click();
  await toast(page).waitFor();
  await page.waitForTimeout(3500);
  await page.goto("/my-logs");
  await page.locator("main li a").first().waitFor();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); // both badges sit at the bottom
  await s.shot(page, "records-badges", {
    corrected: page.getByText(s.ui("correctedBadge")),
    voided: page.getByText(s.ui("voidedBadge")),
  });

  // Recent trees on the home screen
  await page.goto("/scan");
  await page.getByText(s.ui("recentTreesTitle")).waitFor();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await s.shot(page, "scan-recent", { recent: page.getByText(s.ui("recentTreesTitle")).locator("..") });
  await ctx.close();

  // --- No GPS: location permission not granted ---
  {
    const { ctx: c2, page: p2 } = await phone(browser, lang, { permissions: ["camera"] });
    await login(p2, s, username, PIN, /\/scan/);
    await p2.goto(`/tree/${treeB}`);
    await openTask(p2, s, "watering_v1");
    await p2.getByText(s.ui("gpsOffWarning")).waitFor({ timeout: 15000 });
    await s.shot(p2, "err-gps", {
      warn: p2.getByText(s.ui("gpsOffWarning")),
      retry: p2.getByRole("button", { name: s.ui("retryButton") }),
    });
    await c2.close();
  }

  // --- No camera ---
  {
    const { ctx: c3, page: p3 } = await phone(browser, lang, { permissions: ["geolocation"], noCamera: true });
    await login(p3, s, username, PIN, /\/scan/);
    await p3.waitForTimeout(2500);
    await s.shot(p3, "err-camera", {
      msg: p3.getByText(s.ui("cameraUnavailableTitle")).first(),
      typed: p3.getByLabel(s.ui("treeIdLabel")),
    });
    await c3.close();
  }

  s.save();
}

// ---------------------------------------------------------------------------
// Manager manual (Thai)
// ---------------------------------------------------------------------------

async function managerScreens(browser: Browser, ids: { thWorker: string }) {
  console.log("manager (th)");
  const s = new Shooter(resolve(ROOT, "manager-th"), "th");
  const { ctx, page } = await phone(browser, "th");

  await page.goto("/login");
  await page.getByLabel(s.ui("usernameOrEmailLabel")).fill("manager@farm.local");
  await page.getByLabel(s.ui("passwordLabel")).fill("manager1234");
  await s.shot(page, "login", {
    user: page.getByLabel(s.ui("usernameOrEmailLabel")),
    pass: page.getByLabel(s.ui("passwordLabel")),
  });
  await page.getByRole("button", { name: s.ui("loginButton") }).click();
  await page.waitForURL(/\/dashboard/);

  // Dashboard
  await page.getByText(s.ui("statOpenAlerts")).waitFor();
  await s.shot(page, "dashboard", {
    range: page.getByText(s.ui("filterRange")).locator(".."),
    zone: page.getByText(s.ui("zoneLabel"), { exact: true }).first().locator(".."),
    tiles: page.getByText(s.ui("statOpenAlerts")).locator("../.."),
    nav: page.locator("nav").last(),
  }, { settle: 1200 });
  // Put "recent alerts" just under the sticky header so "recent logs" fits below it.
  await page.getByText(s.ui("recentAlertsTitle")).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 90));
  await s.shot(page, "dashboard-lists", {
    alerts: page.getByText(s.ui("recentAlertsTitle")),
    logs: page.getByText(s.ui("recentLogsTitle")),
  });
  // Help popover on a tile
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: s.ui("statOpenAlerts") }).first().click().catch(() => {});
  await s.shot(page, "dashboard-help", {}, { settle: 500 });
  await page.keyboard.press("Escape");

  // Alerts
  await page.goto("/alerts");
  await page.getByRole("tab", { name: new RegExp(s.ui("statusOpen")) }).waitFor();
  await page.locator("main li").first().waitFor();
  const zCard = page.locator("main li").filter({ hasText: "ZR3-1" }).first();
  await s.shot(page, "alerts", {
    tabs: page.getByRole("tablist"),
    card: zCard,
    resolve: zCard.getByRole("button", { name: s.ui("statusResolved") }),
    dismiss: zCard.getByRole("button", { name: s.ui("dismissAction") }),
  });

  // Log detail behind the demo fraud alert (only ever touch the demo tree's alert —
  // the dev database is shared).
  const fraudCard = page.locator("main li").filter({ hasText: "ZR3-2" }).filter({ hasText: s.ui("flag_gps_off_tree") }).first();
  await fraudCard.getByRole("link", { name: new RegExp(s.ui("viewLogLink")) }).click();
  await page.waitForURL(/\/logs\//);
  const loaded = await page.getByText(s.ui("gpsDistanceLabel")).waitFor({ timeout: 10_000 }).then(() => true, () => false);
  if (loaded) {
    await s.shot(page, "log-detail", {
      who: page.getByText(s.ui("submittedByLabel")).locator(".."),
      dist: page.getByText(s.ui("gpsDistanceLabel")).locator(".."),
      flags: page.getByText(s.ui("flagsLabel")).locator(".."),
    });
  } else {
    console.warn("  ! log-detail: page failed to load (known API bug) — skipped");
  }

  // Resolve the fraud alert (with undo toast)
  await page.goto("/alerts");
  await page.locator("main li").filter({ hasText: "ZR3-2" }).first().getByRole("button", { name: s.ui("statusResolved") }).click();
  await toast(page).waitFor();
  await s.shot(page, "alerts-undo", { undo: toast(page) }, { settle: 200 });
  await page.waitForTimeout(6500);

  // Logs
  await page.goto("/logs");
  await page.locator("main li a").first().waitFor();
  await s.shot(page, "logs", {
    range: page.getByText(s.ui("filterRange")).locator(".."),
    filters: page.locator("#f-task").locator("../.."),
    row: page.locator("main li a").first(),
  });
  await page.goto("/logs?task=harvest&range=week");
  await page.getByText(s.ui("gradeSummaryTitle")).first().waitFor().catch(() => {});
  await s.shot(page, "logs-harvest", { grades: page.getByLabel(s.ui("gradeSummaryTitle")) });

  // Workers
  await page.goto("/workers");
  await page.locator("main li a").first().waitFor();
  await s.shot(page, "workers", {
    add: page.getByRole("link", { name: s.ui("addWorkerButton") }),
    filter: page.getByRole("button", { name: s.ui("filterActive") }),
    card: page.locator("main li a").first(),
  });
  await page.goto(`/workers/${ids.thWorker}`);
  await page.getByText(s.ui("trustTierLabel")).first().waitFor();
  await s.shot(page, "worker-detail", {
    stats: page.getByText(s.ui("reliabilityRecent")).first().locator("../.."),
    tier: page.getByRole("group", { name: s.ui("trustTierLabel") }),
  });
  await page.locator("#worker-pin").scrollIntoViewIfNeeded();
  await page.locator("#worker-pin").fill("5678");
  await s.shot(page, "worker-edit", {
    lang: page.getByRole("group", { name: s.ui("languageFieldLabel") }),
    pin: page.locator("#worker-pin"),
    reset: page.getByRole("button", { name: s.ui("resetPinButton") }),
  });
  await page.getByRole("button", { name: s.ui("deactivateWorkerButton") }).scrollIntoViewIfNeeded();
  await s.shot(page, "worker-deactivate", { off: page.getByRole("button", { name: s.ui("deactivateWorkerButton") }) });

  // New worker
  await page.goto("/workers/new");
  await page.locator("#new-worker-name").fill("มินโซ");
  await page.locator("#new-worker-username").fill("minzaw");
  await page.locator("#new-worker-pin").fill("4826");
  await s.shot(page, "worker-new", {
    name: page.locator("#new-worker-name"),
    user: page.locator("#new-worker-username"),
    pin: page.locator("#new-worker-pin"),
    lang: page.getByRole("group", { name: s.ui("languageFieldLabel") }),
    create: page.getByRole("button", { name: s.ui("createAccountButton") }),
  });
  await page.getByRole("button", { name: s.ui("createAccountButton") }).click();
  await page.getByText(s.ui("accountCreatedTitle")).waitFor();
  await page.waitForTimeout(3500);
  await s.shot(page, "worker-created", { copy: page.getByRole("button", { name: s.ui("copyCredentialsButton") }) });

  // Trees
  await page.goto("/trees");
  await page.getByPlaceholder(s.ui("searchTreePlaceholder")).waitFor();
  await page.getByPlaceholder(s.ui("searchTreePlaceholder")).fill("ZL");
  await page.waitForTimeout(600);
  await s.shot(page, "trees", {
    search: page.getByPlaceholder(s.ui("searchTreePlaceholder")),
    add: page.getByRole("link", { name: s.ui("addTreeButton") }),
  });
  await page.goto("/trees/ZR3-3");
  await page.getByText(s.ui("setsTitle")).first().waitFor();
  await s.shot(page, "tree-detail", { qr: page.getByRole("button", { name: s.ui("downloadQr") }) });
  await page.getByText(s.ui("setsTitle")).first().scrollIntoViewIfNeeded();
  await s.shot(page, "tree-sets", { sets: page.getByText(s.ui("setsTitle")).first() });
  // Demo trees have no captured location, like the seeded farm trees — the page says so.
  const notice = page.getByText(s.ui("locationNotCaptured")).first();
  await notice.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 200));
  await s.shot(page, "tree-location", {
    notice,
    recapture: page.getByRole("button", { name: s.ui("recaptureLocation") }),
  });
  await page.getByRole("button", { name: s.ui("retireTreeButton") }).scrollIntoViewIfNeeded();
  await s.shot(page, "tree-retire", { retire: page.getByRole("button", { name: s.ui("retireTreeButton") }) });

  await page.goto("/trees/new");
  await page.getByLabel(s.ui("treeIdLabel")).fill("ZL9-9");
  await s.shot(page, "tree-new", {
    id: page.getByLabel(s.ui("treeIdLabel")),
    gps: page.getByRole("button", { name: s.ui("currentLocationButton") }),
  });
  await ctx.close();

  // Owner: managers page
  const { ctx: oc, page: op } = await phone(browser, "th");
  await login(op, s, "owner@farm.local", "owner1234", /\/dashboard/);
  await op.goto("/managers");
  await op.getByRole("link", { name: s.ui("addManagerButton") }).waitFor();
  await s.shot(op, "owner-managers", {
    add: op.getByRole("link", { name: s.ui("addManagerButton") }),
    tab: op.locator("nav").last().getByText(s.ui("navManagers")),
  });
  await oc.close();

  s.save();
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("cleaning leftovers from earlier runs…");
  await cleanup();

  const thWorker = await createWorker("e2e_manual_th", "สมชาย ใจดี", "th");
  const myWorker = await createWorker("e2e_manual_my", "မောင်မောင်", "my");
  const extraWorker = await createWorker("e2e_manual_x", "ทองดี มีสุข", "th", "audit");
  for (const t of ["ZL1-1", "ZL1-2", "ZL2-1", "ZL2-2", "ZR3-1", "ZR3-2", "ZR3-3"]) await createTree(t);

  // History for the manager screens (on top of what the worker walkthroughs submit)
  await rpcLog("ZR3-1", extraWorker, "watering", "watering_v1", { duration_minutes: 20 }, { minutesAgo: 300 });
  await rpcLog("ZR3-1", extraWorker, "pest_inspection", "pest_inspection_v1", { severity: "severe" }, { minutesAgo: 240 });
  await rpcLog("ZR3-2", extraWorker, "watering", "watering_v1", { duration_minutes: 25 }, { minutesAgo: 200, flags: ["gps_off_tree"], gpsDelta: 64 });
  const bloom = await rpcLog("ZR3-3", thWorker, "bloom_log", "bloom_log_v1", { color: "yellow", flower_count: 90 }, { minutesAgo: 180 });
  await rpcLog("ZR3-3", thWorker, "harvest", "harvest_log_v1", { set_id: bloom.set_id, grade_counts: { A: 30, B: 18, C: 6, reject: 3 } }, { minutesAgo: 120 });
  await rpcLog("ZR3-3", myWorker, "fertilizer", "fertilizer_application_v1", { fertilizer_type: "organic_compost", amount_kg: 25 }, { minutesAgo: 90, flags: ["value_out_of_warn_range"] });

  const browser = await chromium.launch();
  try {
    const only = process.argv[2];
    if (!only || only === "th") await workerScreens(browser, "th", "e2e_manual_th", "ZL1-1", "ZL1-2");
    if (!only || only === "my") await workerScreens(browser, "my", "e2e_manual_my", "ZL2-1", "ZL2-2");
    if (!only || only === "manager") await managerScreens(browser, { thWorker });
  } catch (e) {
    await lastPage?.screenshot({ path: resolve(ROOT, "_failure.png") }).catch(() => {});
    console.error(`failed on ${lastPage?.url()} — see screenshots/_failure.png`);
    throw e;
  } finally {
    await browser.close();
    if (!process.env.KEEP_DATA) {
      console.log("removing demo data…");
      await cleanup();
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
