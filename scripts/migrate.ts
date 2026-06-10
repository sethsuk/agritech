import { Client } from "pg";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { config } from "dotenv";

config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("❌  DATABASE_URL is not set in .env.local");
  console.error("   Get it from: Supabase Dashboard → Project Settings → Database → Connection string → URI");
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "supabase/migrations");
const seedDir = join(process.cwd(), "supabase/seed");

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("✓  Connected to database\n");

  // Run migrations in order
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    process.stdout.write(`  Running ${file}... `);
    try {
      await client.query(sql);
      console.log("✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Skip "already exists" errors so the script is re-runnable
      if (msg.includes("already exists")) {
        console.log("(already exists, skipped)");
      } else {
        console.error(`\n❌  Failed:\n${msg}`);
        await client.end();
        process.exit(1);
      }
    }
  }

  // Run task-definitions seed
  const seedFile = join(seedDir, "01_task_definitions.sql");
  process.stdout.write(`\n  Seeding task definitions... `);
  try {
    const sql = readFileSync(seedFile, "utf-8");
    await client.query(sql);
    console.log("✓");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      console.log("(already seeded, skipped)");
    } else {
      console.error(`\n❌  Seed failed:\n${msg}`);
    }
  }

  await client.end();
  console.log("\n✅  Done! Database is ready.");
  console.log("   Next: run the tree seed with: npm run db:seed:trees");
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
