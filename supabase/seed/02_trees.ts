/**
 * Seed 600 trees across 4 zones.
 * Tree IDs: NA-001…NA-150, NB-001…NB-150, SA-001…SA-150, SB-001…SB-150
 * Run: npm run db:seed:trees
 */
import { Client } from "pg";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const ZONES = [
  { name: "North-A", prefix: "NA" },
  { name: "North-B", prefix: "NB" },
  { name: "South-A", prefix: "SA" },
  { name: "South-B", prefix: "SB" },
];

const ROWS_PER_ZONE = 15;
const POSITIONS_PER_ROW = 10;
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
    await client.end();
    return;
  }

  let inserted = 0;

  for (let zi = 0; zi < ZONES.length; zi++) {
    const { name: zone, prefix } = ZONES[zi];
    const latOffset = zi * 0.002;

    for (let row = 1; row <= ROWS_PER_ZONE; row++) {
      for (let pos = 1; pos <= POSITIONS_PER_ROW; pos++) {
        const treeNum = (row - 1) * POSITIONS_PER_ROW + pos;
        const treeId = `${prefix}-${String(treeNum).padStart(3, "0")}`;
        const qrCode = `QR_${prefix}${String(treeNum).padStart(3, "0")}_v1`;
        const variety = VARIETIES[Math.floor(Math.random() * VARIETIES.length)];
        const lat = BASE_LAT + latOffset + row * 0.00005;
        const long = BASE_LONG + pos * 0.00005;

        await client.query(
          `INSERT INTO trees (tree_id, qr_code, lat, long, zone, row_num, position, variety, status, planted_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active','2018-03-15')`,
          [treeId, qrCode, lat, long, zone, row, pos, variety],
        );
        inserted++;
      }
    }
    console.log(`  ${zone} (${prefix}) ✓`);
  }

  await client.end();
  console.log(`\n✅  ${inserted} trees inserted.`);
  console.log("   Sample IDs to try: NA-001, NB-001, SA-001, SB-001");
}

seed().catch((err) => { console.error("Error:", err.message); process.exit(1); });
