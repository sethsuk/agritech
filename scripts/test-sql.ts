/**
 * SQL tests for the RPCs and views: every tests/sql/NN_*.sql runs after _prelude.sql
 * inside BEGIN … ROLLBACK, so nothing persists. Assertions use plpgsql ASSERT, which
 * raises on failure. Runs against DATABASE_URL (.env.local) — the dev database.
 *
 *   npm run test:sql
 */
import { Client } from "pg";
import { config } from "dotenv";
import { readdirSync, readFileSync } from "fs";
import { join, resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const dir = join(process.cwd(), "tests/sql");
const prelude = readFileSync(join(dir, "_prelude.sql"), "utf8");
const only = process.argv[2];

async function run() {
  const files = readdirSync(dir).filter((f) => /^\d+_.*\.sql$/.test(f) && (!only || f.includes(only))).sort();
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  let failed = 0;
  for (const file of files) {
    try {
      await client.query("BEGIN");
      await client.query(prelude);
      await client.query(readFileSync(join(dir, file), "utf8"));
      console.log(`  ✓ ${file}`);
    } catch (err) {
      failed++;
      const e = err as { message?: string; where?: string };
      console.log(`  ✘ ${file}\n      ${e.message}${e.where ? `\n      at ${e.where.split("\n")[0]}` : ""}`);
    } finally {
      await client.query("ROLLBACK");
    }
  }
  await client.end();

  let total = files.length;
  if (!only || "concurrency".includes(only)) {
    total++;
    try {
      await concurrencyTest();
      console.log("  ✓ concurrency: void vs. set-emptying harvest on the same set");
    } catch (err) {
      failed++;
      console.log(`  ✘ concurrency: ${(err as Error).message}`);
    }
  }
  console.log(`\n${total - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });

/**
 * M2: two connections race a void of an earlier harvest against a new harvest that
 * would empty the set. Every set-touching RPC takes the tree row lock first, so the
 * second waits for the first to commit and sync_set sees both — the set must end OPEN
 * with fruit remaining. (Before the lock-order fix the void only locked its log row and
 * the set could end closed with fruit left.) Needs real commits, so it uses its own
 * zone-Z tree and deletes everything it made.
 */
async function concurrencyTest() {
  const url = process.env.DATABASE_URL;
  const mk = () => new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const a = mk(), b = mk();
  await a.connect(); await b.connect();
  const tree = `ZL${1 + Math.floor(Math.random() * 98)}-${1 + Math.floor(Math.random() * 98)}`;
  const worker = (await a.query("SELECT worker_id FROM workers ORDER BY created_at LIMIT 1")).rows[0].worker_id;
  const submit = (c: Client, type: string, def: string, form: object, secs: number) =>
    c.query("SELECT submit_task_log($1::jsonb) r", [JSON.stringify({
      tree_id: tree, task_def_id: def, task_type: type, worker_id: worker,
      submitted_at: new Date(Date.now() + secs * 1000).toISOString(),
      form_opened_at: new Date().toISOString(), qr_scanned_at: new Date().toISOString(),
      qr_value: `QR_${tree}_v1`, validation_status: "passed", validation_flags: [], form_data: form,
    })]).then((r) => r.rows[0].r);

  try {
    await a.query(
      `INSERT INTO trees (tree_id, qr_code, lat, long, zone, side, row_num, position, planted_date, variety)
       VALUES ($1, $2, 18.75, 98.95, 'Z', 'L', 1, 1, '2020-01-01', 'Monthong')`,
      [tree, `QR_${tree}_v1`],
    );
    const bloom = await submit(a, "bloom_log", "bloom_log_v1", { color: "red", flower_count: 10 }, 1);
    const setId = bloom.set_id;
    const h1 = await submit(a, "harvest", "harvest_log_v1", { set_id: setId, grade_counts: { A: 5 } }, 2);

    await a.query("BEGIN");
    await a.query("SELECT void_task_log($1, $2, 'race')", [h1.log_id, worker]); // holds the tree lock
    await b.query("BEGIN");
    const pending = submit(b, "harvest", "harvest_log_v1", { set_id: setId, grade_counts: { A: 5 } }, 3); // blocks
    await new Promise((r) => setTimeout(r, 300));
    await a.query("COMMIT");
    await pending;
    await b.query("COMMIT");

    const st = (await a.query("SELECT closed_at, remaining FROM set_state WHERE set_id = $1", [setId])).rows[0];
    if (st.closed_at !== null || st.remaining !== 5) {
      throw new Error(`expected open set with 5 left, got closed_at=${st.closed_at} remaining=${st.remaining}`);
    }
  } finally {
    await a.query("ROLLBACK").catch(() => {});
    await b.query("ROLLBACK").catch(() => {});
    await a.query(`DELETE FROM alerts WHERE tree_id = $1`, [tree]);
    await a.query(`UPDATE task_logs SET set_id = NULL WHERE tree_id = $1`, [tree]);
    await a.query(`DELETE FROM sets WHERE tree_id = $1`, [tree]);
    await a.query(`DELETE FROM task_logs WHERE tree_id = $1 AND correction_of_log_id IS NOT NULL`, [tree]);
    await a.query(`DELETE FROM task_logs WHERE tree_id = $1`, [tree]);
    await a.query(`DELETE FROM trees WHERE tree_id = $1`, [tree]);
    await a.query(`SELECT rollup_rebuild()`); // direct deletes bypass rollup maintenance
    await a.end(); await b.end();
  }
}
