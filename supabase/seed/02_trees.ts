/**
 * Seed 600 trees across 4 zones in Northern Thailand (Chiang Mai area).
 * Run: npx tsx supabase/seed/02_trees.ts
 *
 * Prerequisites: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ZONES = ["North-A", "North-B", "South-A", "South-B"];
const ROWS_PER_ZONE = 15;
const POSITIONS_PER_ROW = 10; // 150 trees × 4 zones = 600

// Chiang Mai durian growing area (approx.)
const BASE_LAT = 18.7000;
const BASE_LONG = 98.9000;
const VARIETIES = ["Monthong", "Chanee", "Puangmanee"];

async function seed() {
  const trees = [];

  for (const zone of ZONES) {
    const zoneLetter = zone.split("-")[1]; // "A" or "B"
    const zoneIndex = ZONES.indexOf(zone);
    const latOffset = zoneIndex * 0.002; // ~220m between zones

    for (let row = 1; row <= ROWS_PER_ZONE; row++) {
      for (let pos = 1; pos <= POSITIONS_PER_ROW; pos++) {
        const treeNum = (row - 1) * POSITIONS_PER_ROW + pos;
        const treeId = `${zoneLetter}-${String(treeNum).padStart(3, "0")}`;

        trees.push({
          tree_id: treeId,
          qr_code: `QR_${treeId.replace("-", "")}_v1`,
          lat: BASE_LAT + latOffset + row * 0.00005 + (Math.random() * 0.00001),
          long: BASE_LONG + pos * 0.00005 + (Math.random() * 0.00001),
          zone,
          row_num: row,
          position: pos,
          planted_date: "2018-03-15",
          variety: VARIETIES[Math.floor(Math.random() * VARIETIES.length)],
          status: "active",
        });
      }
    }
  }

  console.log(`Inserting ${trees.length} trees...`);
  const { error } = await supabase.from("trees").insert(trees);
  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
  console.log("Done.");
}

seed();
