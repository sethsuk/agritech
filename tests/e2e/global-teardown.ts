import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import ws from "ws";

// Same eager-RealtimeClient WebSocket requirement as scripts/*.ts — see CLAUDE.md.
(globalThis as { WebSocket?: unknown }).WebSocket ??= ws;

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

/**
 * Removes everything the suite created:
 *  - trees in the e2e-only zone "Z" (helpers.freshTree) and all their logs/sets/alerts;
 *  - accounts with the `e2e_` username prefix, plus any logs they wrote (task_logs has
 *    no ON DELETE CASCADE, so those must go before the auth user can be deleted).
 */
export default async function globalTeardown() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  try {
    await pg.query("BEGIN");
    const scope = `(tree_id LIKE 'Z%' OR worker_id IN (SELECT id FROM auth.users WHERE email LIKE 'e2e\\_%'))`;
    await pg.query(`DELETE FROM public.alerts WHERE ${scope} OR resolution_resolved_by IN (SELECT id FROM auth.users WHERE email LIKE 'e2e\\_%')`);
    await pg.query(`UPDATE public.task_logs SET set_id = NULL WHERE ${scope}`);
    await pg.query(`DELETE FROM public.sets WHERE tree_id LIKE 'Z%' OR bloom_log_id IN (SELECT log_id FROM public.task_logs WHERE ${scope})`);
    await pg.query(`DELETE FROM public.task_logs WHERE correction_of_log_id IS NOT NULL AND ${scope}`);
    await pg.query(`DELETE FROM public.task_logs WHERE ${scope}`);
    await pg.query(`DELETE FROM public.trees WHERE tree_id LIKE 'Z%'`);
    // Direct deletes bypass the write RPCs that maintain the daily rollups — recompute them.
    await pg.query(`SELECT public.rollup_rebuild()`);
    await pg.query("COMMIT");
  } catch (err) {
    await pg.query("ROLLBACK");
    console.error("global-teardown: data cleanup failed:", err);
  } finally {
    await pg.end();
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("global-teardown: listUsers failed:", error.message);
      return;
    }
    for (const user of data.users.filter((u) => u.email?.startsWith("e2e_"))) {
      const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
      if (delErr) console.error(`  e2e cleanup: could not delete ${user.email}: ${delErr.message}`);
    }
    if (data.users.length < 200) break;
  }
}
