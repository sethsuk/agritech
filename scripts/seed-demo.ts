/**
 * Test accounts + sample farm activity, so people can try the app before real use.
 *
 *   ENV_FILE=.env.prod npx tsx scripts/seed-demo.ts             # accounts + ~4 weeks of logs
 *   ENV_FILE=.env.prod npx tsx scripts/seed-demo.ts --reset     # delete all test activity
 *   ENV_FILE=.env.prod npx tsx scripts/seed-demo.ts --reset --remove-accounts
 *
 * ENV_FILE is required (no default), so the target database is always explicit.
 *
 * Everything belongs to accounts whose username starts with `test_` (display names start
 * with "(ทดสอบ)"), so --reset can remove it all before real use: their logs, the sets
 * their blooms opened (and any log on those sets), the alerts those logs raised, then
 * the daily rollups are rebuilt. Trees and real accounts are never touched.
 *
 * Accounts are created with random credentials (no guessable logins on a live site),
 * printed once. Re-running keeps existing accounts and their credentials; it refuses to
 * add sample logs twice. Logs go through submit_task_log in ONE transaction — sets,
 * alerts and rollups come out exactly as if the workers had logged them, or not at all.
 */
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { randomInt } from "crypto";
import ws from "ws";
import { toAuthPassword } from "../lib/auth/pin";

(globalThis as { WebSocket?: unknown }).WebSocket ??= ws;

const ENV_FILE = process.env.ENV_FILE;
if (!ENV_FILE) {
  console.error("❌  Set ENV_FILE (.env.local for dev, .env.prod for production).");
  process.exit(1);
}
config({ path: resolve(process.cwd(), ENV_FILE), quiet: true });

const args = new Set(process.argv.slice(2));
const PREFIX = "test_";
const EMAIL_LIKE = `${PREFIX.replace("_", "\\_")}%@farm.local`;

type Account = { username: string; role: "manager" | "worker"; name: string; language?: "th" | "my" | "en" };
const ACCOUNTS: Account[] = [
  { username: "test_manager", role: "manager", name: "(ทดสอบ) ผู้จัดการ" },
  { username: "test_worker1", role: "worker", name: "(ทดสอบ) สมชาย", language: "th" },
  { username: "test_worker2", role: "worker", name: "(ทดสอบ) U Aung", language: "my" },
  { username: "test_worker3", role: "worker", name: "(ทดสอบ) Daw Khin", language: "my" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// ---------------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------------
function randomPassword(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => abc[randomInt(abc.length)]).join("");
}
function randomPin(): string {
  for (;;) {
    const pin = String(randomInt(10000)).padStart(4, "0");
    const same = /^(\d)\1{3}$/.test(pin);
    const seq = "0123456789".includes(pin) || "9876543210".includes(pin);
    if (!same && !seq) return pin;
  }
}

async function findAuthUserId(email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureAccounts(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const created: string[] = [];
  for (const a of ACCOUNTS) {
    const email = `${a.username}@farm.local`;
    let id = await findAuthUserId(email);
    let secret = "(unchanged — reset it in the app if lost)";
    if (!id) {
      secret = a.role === "worker" ? randomPin() : randomPassword();
      const { data, error } = await admin.auth.admin.createUser({ email, password: toAuthPassword(secret), email_confirm: true });
      if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
      id = data.user.id;
    }
    const { error: uErr } = await admin.from("users").upsert({ id, role: a.role, display_name: a.name }, { onConflict: "id" });
    if (uErr) throw new Error(`users ${email}: ${uErr.message}`);
    if (a.role === "worker") {
      const { error: wErr } = await admin.from("workers").upsert(
        { worker_id: id, language: a.language, assigned_zones: ["A"], trust_tier: "standard", active: true },
        { onConflict: "worker_id" },
      );
      if (wErr) throw new Error(`workers ${email}: ${wErr.message}`);
    }
    ids.set(a.username, id);
    created.push(`  ${a.role.padEnd(8)} ${a.username.padEnd(14)} ${a.role === "worker" ? "PIN " : "password "}${secret}`);
  }
  console.log("\nTest accounts (sign in with the username, no @farm.local needed):");
  for (const line of created) console.log(line);
  return ids;
}

// ---------------------------------------------------------------------------------
// Sample activity
// ---------------------------------------------------------------------------------
/** Deterministic PRNG (mulberry32) so a re-run after --reset gives the same farm. */
function prng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = prng(20261124);
const between = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const MATURATION: Record<string, number> = { monthong: 120, kanyao: 125, chanee: 105, puangmanee: 100 };

type Tree = { tree_id: string; qr_code: string; variety: string; side: string; row_num: number; position: number };
type Item = Record<string, unknown> & { submitted_at: string };

const NOW = Date.now();
const BKK_MS = 7 * 3600_000;
/** A Bangkok wall-clock time `daysAgo` days before today, as a Date. */
function bkk(daysAgo: number, hour: number, minute: number): Date {
  const today = new Date(NOW + BKK_MS);
  const d = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysAgo, hour, minute);
  return new Date(d - BKK_MS);
}

function buildActivity(trees: Tree[], workers: Record<string, string>): Item[] {
  const items: Item[] = [];
  const ownerOf = (t: Tree) => (t.row_num === 4 ? workers.test_worker3 : t.side === "L" ? workers.test_worker1 : workers.test_worker2);

  const log = (t: Tree, daysAgo: number, task_type: string, task_def_id: string, form: object, extra: { setColor?: string; flags?: string[]; qr?: string } = {}) => {
    const at = bkk(daysAgo, between(7, 16), between(0, 59));
    if (at.getTime() > NOW - 60_000) return; // no logs from the future (today's are only before now)
    let opened = new Date(at.getTime() - between(45, 200) * 1000);
    let scanned = new Date(opened.getTime() - between(8, 40) * 1000);
    const flags = [...(extra.flags ?? [])];
    if (!extra.flags && rnd() < 0.03) { // a rushed form now and then
      opened = new Date(at.getTime() - 6000); scanned = new Date(at.getTime() - 10_000);
      flags.push("completion_too_fast", "qr_to_submit_too_fast");
    }
    let qr = extra.qr ?? t.qr_code;
    if (!extra.qr && !extra.flags && rnd() < 0.02) { qr = t.tree_id; flags.push("manual_entry"); } // typed the ID
    items.push({
      tree_id: t.tree_id, task_def_id, task_type, worker_id: ownerOf(t),
      submitted_at: at.toISOString(), form_opened_at: opened.toISOString(), qr_scanned_at: scanned.toISOString(),
      qr_value: qr, validation_status: flags.length ? "flagged" : "passed", validation_flags: flags,
      form_data: form, ...(extra.setColor ? { _set_color: extra.setColor } : {}),
    });
  };

  // Routine care over the last 28 days: watering every 3 days, pest check weekly,
  // fertiliser and soil every 2 weeks — staggered per tree so each day is a mix.
  for (let d = 27; d >= 0; d--) {
    trees.forEach((t, i) => {
      if ((d + i) % 3 === 0) {
        const long = rnd() < 0.02;
        log(t, d, "watering", "watering_v1", { duration_minutes: long ? 65 : between(3, 9) * 5 },
          long ? { flags: ["value_out_of_warn_range:duration_minutes"] } : {});
      }
      if ((d + i) % 7 === 0) {
        const r = rnd();
        const severity = r < 0.74 ? "none" : r < 0.94 ? "mild" : r < 0.985 ? "moderate" : "severe";
        log(t, d, "pest_inspection", "pest_inspection_v1", { severity });
      }
      if ((d + i) % 14 === 0) {
        log(t, d, "fertilizer", "fertilizer_application_v1", {
          fertilizer_type: pick(["NPK-16-16-16", "NPK-16-16-16", "NPK-8-24-24", "organic_compost"]),
          amount_kg: between(4, 16) / 2,
        });
      }
      if ((d + i + 7) % 14 === 0) {
        log(t, d, "soil_check", "soil_acidity_check_v1", { ph: between(55, 68) / 10, moisture_pct: between(35, 75) });
      }
    });
  }
  // One scan of the wrong tree's QR code, to show a tier-1 fraud alert.
  log(trees[5], 2, "watering", "watering_v1", { duration_minutes: 20 }, { flags: ["qr_mismatch"], qr: trees[6].qr_code });

  // Sets. Every third tree bloomed months ago (red ribbon), staggered so the harvest
  // windows are upcoming, open, finished or overdue; ~10 trees bloomed recently (blue).
  const offsets = [-25, -15, -6, 0, 4, 9, 14]; // days past the expected harvest date
  let overHarvestDone = false;
  trees.filter((_, i) => i % 3 === 0).forEach((t, k) => {
    const mat = MATURATION[t.variety.toLowerCase()] ?? 120;
    const offset = offsets[k % offsets.length];
    const bloomAgo = mat + offset;
    const flowers = between(90, 180);
    log(t, bloomAgo, "bloom_log", "bloom_log_v1", { color: "red", flower_count: flowers }, { flags: [] });
    let remaining = Math.round(flowers * (0.45 + rnd() * 0.2));
    log(t, bloomAgo - 40, "fruit_check", "fruit_count_v1", { set_id: "", fruit_count: remaining }, { setColor: "red", flags: [] });
    remaining = Math.round(remaining * (0.8 + rnd() * 0.15));
    log(t, Math.max(15, offset + 20), "fruit_check", "fruit_count_v1", { set_id: "", fruit_count: remaining }, { setColor: "red", flags: [] });

    const grades = (n: number) => {
      const a = Math.round(n * 0.5), b = Math.round(n * 0.3), c = Math.round(n * 0.15);
      return { A: a, B: b, C: c, reject: Math.max(0, n - a - b - c) };
    };
    if (offset === 0 || offset === 4) { // in the window: partial picks, set stays open
      const n1 = Math.round(remaining * 0.35);
      log(t, Math.min(offset + 6, 12), "harvest", "harvest_log_v1", { set_id: "", grade_counts: grades(n1), final_pick: false }, { setColor: "red", flags: [] });
      remaining -= n1;
      if (offset === 4) {
        const over = !overHarvestDone; // one miscount: picked more than the set had left
        overHarvestDone = true;
        const n2 = over ? remaining + 5 : Math.round(remaining * 0.4);
        log(t, 3, "harvest", "harvest_log_v1", { set_id: "", grade_counts: grades(n2), final_pick: false }, { setColor: "red", flags: [] });
      }
    } else if (offset === 9) { // finished: two picks, the last one closes the set
      const n1 = Math.round(remaining * 0.5);
      log(t, 13, "harvest", "harvest_log_v1", { set_id: "", grade_counts: grades(n1), final_pick: false }, { setColor: "red", flags: [] });
      log(t, 5, "harvest", "harvest_log_v1", { set_id: "", grade_counts: grades(Math.round((remaining - n1) * 0.85)), final_pick: true }, { setColor: "red", flags: [] });
    }
    // offset 14: never harvested → shows as overdue. Negative offsets: not ripe yet.
  });
  trees.filter((_, i) => i % 3 === 1).slice(0, 10).forEach((t) => {
    const big = rnd() < 0.1;
    log(t, between(3, 25), "bloom_log", "bloom_log_v1", { color: "blue", flower_count: big ? 230 : between(60, 190) },
      big ? { flags: ["value_out_of_warn_range:flower_count"] } : { flags: [] });
  });

  return items.sort((a, b) => a.submitted_at.localeCompare(b.submitted_at));
}

async function seedActivity(workers: Record<string, string>) {
  const { rows: [{ n }] } = await pg.query(
    `SELECT count(*)::int n FROM task_logs WHERE worker_id IN (SELECT id FROM auth.users WHERE email LIKE $1)`, [EMAIL_LIKE]);
  if (n > 0) {
    console.log(`\nSample activity already present (${n} logs) — not adding it twice. Run with --reset first to start over.`);
    return;
  }
  const { rows: trees } = await pg.query<Tree>(
    `SELECT tree_id, qr_code, variety, side, row_num, position FROM trees
     WHERE zone = 'A' AND status = 'active' AND row_num <= 4 AND position <= 12 ORDER BY side, row_num, position`);
  if (trees.length < 20) throw new Error(`expected zone A trees, found ${trees.length}`);
  const items = buildActivity(trees, workers);

  // One transaction, one round trip: each log goes through submit_task_log in time order;
  // a fruit count / harvest names its set by ribbon colour and gets the open set's id.
  // Any domain error aborts the whole thing.
  const json = JSON.stringify(items);
  if (json.includes("$items$")) throw new Error("unexpected delimiter in data");
  await pg.query(`DO $do$
  DECLARE x jsonb; r jsonb; s uuid;
  BEGIN
    FOR x IN SELECT value FROM jsonb_array_elements($items$${json}$items$::jsonb) LOOP
      IF x ? '_set_color' THEN
        SELECT set_id INTO s FROM public.sets
        WHERE tree_id = x->>'tree_id' AND color = (x->>'_set_color')::generation_color AND closed_at IS NULL;
        x := jsonb_set(x - '_set_color', '{form_data,set_id}', to_jsonb(s::text));
      END IF;
      r := public.submit_task_log(x);
      IF r ? 'error' THEN
        RAISE EXCEPTION 'submit_task_log refused % on % at %: %', x->>'task_type', x->>'tree_id', x->>'submitted_at', r;
      END IF;
    END LOOP;
  END $do$`);

  const { rows: [s] } = await pg.query(`
    SELECT (SELECT count(*) FROM effective_task_logs l WHERE l.worker_id = ANY($1)) logs,
           (SELECT count(*) FROM sets st JOIN task_logs b ON b.log_id = st.bloom_log_id WHERE b.worker_id = ANY($1)) sets,
           (SELECT count(*) FROM alerts WHERE worker_id = ANY($1) AND status = 'open') alerts`,
    [Object.values(workers)]);
  console.log(`\n✓ Sample activity: ${s.logs} logs on ${trees.length} trees in zone A (rows 1–4), ${s.sets} sets, ${s.alerts} open alerts.`);
}

// ---------------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------------
async function reset(removeAccounts: boolean) {
  const testUsers = `(SELECT id FROM auth.users WHERE email LIKE '${EMAIL_LIKE}')`;
  // Logs by test accounts, plus anything logged on a set a test bloom opened.
  const testSets = `(SELECT st.set_id FROM public.sets st JOIN public.task_logs b ON b.log_id = st.bloom_log_id WHERE b.worker_id IN ${testUsers})`;
  const scope = `(worker_id IN ${testUsers} OR set_id IN ${testSets})`;
  await pg.query("BEGIN");
  try {
    await pg.query(`CREATE TEMP TABLE demo_logs ON COMMIT DROP AS
      SELECT log_id FROM public.task_logs WHERE ${scope}
      UNION SELECT c.log_id FROM public.task_logs c JOIN public.task_logs r ON r.log_id = c.correction_of_log_id WHERE r.worker_id IN ${testUsers} OR r.set_id IN ${testSets}`);
    await pg.query(`CREATE TEMP TABLE demo_sets ON COMMIT DROP AS ${testSets}`);
    const a = await pg.query(`DELETE FROM public.alerts WHERE triggered_by_log_id IN (SELECT log_id FROM demo_logs)
      OR worker_id IN ${testUsers} OR resolution_resolved_by IN ${testUsers}`);
    await pg.query(`UPDATE public.assignments SET completed_log_id = NULL WHERE completed_log_id IN (SELECT log_id FROM demo_logs)`);
    await pg.query(`DELETE FROM public.assignments WHERE worker_id IN ${testUsers}`);
    await pg.query(`UPDATE public.task_logs SET set_id = NULL WHERE log_id IN (SELECT log_id FROM demo_logs)`);
    const st = await pg.query(`DELETE FROM public.sets WHERE set_id IN (SELECT set_id FROM demo_sets)`);
    await pg.query(`DELETE FROM public.task_logs WHERE correction_of_log_id IS NOT NULL AND log_id IN (SELECT log_id FROM demo_logs)`);
    const l = await pg.query(`DELETE FROM public.task_logs WHERE log_id IN (SELECT log_id FROM demo_logs)`);
    await pg.query(`SELECT public.rollup_rebuild()`); // direct deletes bypass the rollup writers
    await pg.query("COMMIT");
    console.log(`✓ Removed test activity: ${l.rowCount} logs, ${st.rowCount} sets, ${a.rowCount} alerts; rollups rebuilt.`);
  } catch (e) {
    await pg.query("ROLLBACK");
    throw e;
  }
  if (!removeAccounts) return;
  for (const acc of ACCOUNTS) {
    const id = await findAuthUserId(`${acc.username}@farm.local`);
    if (!id) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    console.log(error ? `  could not delete ${acc.username}: ${error.message}` : `✓ deleted account ${acc.username}`);
  }
}

async function run() {
  const ref = new URL(url).hostname.split(".")[0];
  if (!new URL(process.env.DATABASE_URL!).username.endsWith(ref)) throw new Error("DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL point at different projects");
  console.log(`Target: ${ENV_FILE} → Supabase project ${ref}`);
  await pg.connect();
  try {
    if (args.has("--reset")) return await reset(args.has("--remove-accounts"));
    const ids = await ensureAccounts();
    await seedActivity(Object.fromEntries(ids));
  } finally {
    await pg.end();
  }
}

run().catch((err) => { console.error("❌ ", err.message ?? err); process.exit(1); });
