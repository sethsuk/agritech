/**
 * Seed durian trees for zone A (the only zone currently laid out).
 * Tree IDs: AL1-1…AL23-23 (left side, 23 rows), AR1-1…AR22-23 (right side, 22 rows).
 * Run: npm run db:seed:trees
 *
 * To reseed from scratch (e.g. after changing the layout below), wipe the table first —
 * this also clears dependent task_logs/sets/alerts/assignments for dummy trees:
 *   psql $DATABASE_URL -c "TRUNCATE public.trees CASCADE;"
 */
import { Client } from "pg";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const ZONE = "A";
const SIDES: { side: "L" | "R"; rows: number }[] = [
  { side: "L", rows: 23 },
  { side: "R", rows: 22 },
];
const COLUMNS_PER_ROW = 23;
const BASE_LAT = 18.7000;
const BASE_LONG = 98.9000;
const VARIETIES = ["Monthong", "Chanee", "Puangmanee"];

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: existing } = await client.query("SELECT COUNT(*) FROM trees");
  if (Number(existing[0].count) > 0) {
    console.log(`Trees already seeded (${existing[0].count} rows). Skipping.`);
    console.log('To reseed: psql $DATABASE_URL -c "TRUNCATE public.trees CASCADE;" then re-run.');
    await client.end();
    return;
  }

  let inserted = 0;

  for (const { side, rows } of SIDES) {
    const sideOffset = side === "L" ? 0 : 0.002;

    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= COLUMNS_PER_ROW; col++) {
        const treeId = `${ZONE}${side}${row}-${col}`;
        const qrCode = `QR_${treeId}_v1`;
        const variety = VARIETIES[Math.floor(Math.random() * VARIETIES.length)];
        const lat = BASE_LAT + sideOffset + row * 0.00005;
        const long = BASE_LONG + col * 0.00005;

        await client.query(
          `INSERT INTO trees (tree_id, qr_code, lat, long, zone, side, row_num, position, variety, status, planted_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active','2018-03-15')`,
          [treeId, qrCode, lat, long, ZONE, side, row, col, variety],
        );
        inserted++;
      }
    }
    console.log(`  Zone ${ZONE}${side} (rows 1-${rows}) ✓`);
  }

  await client.end();
  console.log(`\n✅  ${inserted} trees inserted.`);
  console.log("   Sample IDs to try: AL1-1, AL13-7, AR1-1, AR22-23");
}

seed().catch((err) => { console.error("Error:", err.message); process.exit(1); });
