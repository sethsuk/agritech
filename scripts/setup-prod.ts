/**
 * One-time setup of the PRODUCTION Supabase project, from .env.prod (git-ignored):
 * migrations + task definitions → trees → photo storage bucket → the owner account.
 *
 *   npm run setup:prod
 *
 * Deliberately different from the dev workflow:
 *  - REFUSES to run unless the database is empty (it can't wipe or double-apply anything);
 *  - creates NO dummy logins (worker1/1111 would be guessable on a live site) — only the
 *    owner from OWNER_EMAIL / OWNER_PASSWORD / OWNER_NAME, who then adds managers and
 *    workers inside the app;
 *  - never touches .env.local, so it cannot hit the dev database by accident.
 */
import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";
import ws from "ws";
import { toAuthPassword } from "../lib/auth/pin";

(globalThis as { WebSocket?: unknown }).WebSocket ??= ws;
const ENV_FILE = ".env.prod";
config({ path: resolve(process.cwd(), ENV_FILE), quiet: true });

const need = (k: string) => {
  const v = process.env[k];
  if (!v || /<.*>/.test(v)) { console.error(`❌  ${k} is missing or still a placeholder in ${ENV_FILE}`); process.exit(1); }
  return v;
};

async function run() {
  const url = need("NEXT_PUBLIC_SUPABASE_URL");
  need("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const secret = need("SUPABASE_SERVICE_ROLE_KEY");
  const dbUrl = need("DATABASE_URL");
  const ownerEmail = need("OWNER_EMAIL").toLowerCase();
  const ownerPassword = need("OWNER_PASSWORD");
  const ownerName = process.env.OWNER_NAME || "Owner";
  if (ownerPassword.length < 8) { console.error("❌  OWNER_PASSWORD must be at least 8 characters"); process.exit(1); }

  const ref = new URL(url).hostname.split(".")[0];
  console.log(`Target: production project ${ref}`);
  if (!new URL(dbUrl).username.endsWith(ref)) { console.error("❌  DATABASE_URL and NEXT_PUBLIC_SUPABASE_URL point at different projects"); process.exit(1); }

  const pg = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await pg.connect();
  const { rows } = await pg.query("select count(*)::int n from information_schema.tables where table_schema = 'public'");
  await pg.end();
  if (rows[0].n !== 0) { console.error(`❌  Refusing to run: the database already has ${rows[0].n} tables. This script is for a brand-new project only.`); process.exit(1); }

  const sub = (cmd: string) => execSync(cmd, { stdio: "inherit", env: { ...process.env, ENV_FILE } });
  console.log("\n▶ Migrations + task definitions");
  sub("npx tsx scripts/migrate.ts");
  console.log("\n▶ Trees (1035, placeholder GPS/variety/planted date)");
  sub("npx tsx supabase/seed/02_trees.ts");
  console.log("\n▶ Photo storage bucket");
  sub("npx tsx scripts/setup-storage.ts");

  console.log("\n▶ Owner account");
  const admin = createClient(url, secret);
  const { data, error } = await admin.auth.admin.createUser({
    email: ownerEmail, password: toAuthPassword(ownerPassword), email_confirm: true,
  });
  if (error || !data.user) { console.error("❌  Could not create the owner:", error?.message); process.exit(1); }
  const { error: uErr } = await admin.from("users").insert({ id: data.user.id, role: "owner", display_name: ownerName });
  if (uErr) { await admin.auth.admin.deleteUser(data.user.id); console.error("❌  Could not create the owner profile:", uErr.message); process.exit(1); }
  console.log(`✓  owner ${ownerEmail} created`);

  console.log("\n✅  Production database is ready. Sign in at your site with the owner email + password.");
}

run().catch((err) => { console.error("Unexpected error:", err); process.exit(1); });
