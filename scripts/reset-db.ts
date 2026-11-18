/**
 * DEV ONLY — wipe the app's public schema and rebuild it from scratch:
 * drop tables/views/functions/types → db:migrate → seed trees → seed users.
 *
 * Exists because migrate.ts skips objects that already exist, so editing a migration
 * has no effect on an already-migrated DB (see CLAUDE.md). This replaces the old manual
 * "drop everything by hand" step.
 *
 * Destroys every task log, set and alert. auth.users is NOT touched (seed-users repairs
 * the profile rows for existing auth accounts). Refuses to run without
 * ALLOW_DB_RESET=true so it can't be fired at the wrong database by accident:
 *
 *   ALLOW_DB_RESET=true npm run db:reset:dev
 */
import { Client } from "pg";
import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

if (process.env.ALLOW_DB_RESET !== "true") {
  console.error("Refusing to reset: set ALLOW_DB_RESET=true to confirm you want to WIPE this database.");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

async function wipe() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`Wiping public schema on ${new URL(connectionString!).hostname} ...`);

  // Everything app-owned in `public`, skipping objects that belong to extensions.
  await client.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT c.relname FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind = 'v'
                 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
      LOOP EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', r.relname); END LOOP;

      FOR r IN SELECT c.relname FROM pg_class c
               JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'public' AND c.relkind = 'r'
                 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype = 'e')
      LOOP EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', r.relname); END LOOP;

      FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
               JOIN pg_namespace n ON n.oid = p.pronamespace
               WHERE n.nspname = 'public'
                 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      LOOP EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.sig); END LOOP;

      FOR r IN SELECT t.typname FROM pg_type t
               JOIN pg_namespace n ON n.oid = t.typnamespace
               WHERE n.nspname = 'public' AND t.typtype = 'e'
                 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = t.oid AND d.deptype = 'e')
      LOOP EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', r.typname); END LOOP;
    END $$;
  `);
  await client.end();
  console.log("✓ wiped\n");
}

async function run() {
  await wipe();
  for (const cmd of ["npx tsx scripts/migrate.ts", "npx tsx supabase/seed/02_trees.ts", "npx tsx scripts/seed-users.ts"]) {
    console.log(`$ ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
  }
  console.log("\n✅ Database reset complete.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
