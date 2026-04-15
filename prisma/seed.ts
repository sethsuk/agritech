import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Center the farm in Chanthaburi, a real durian-growing region in Thailand.
const FARM_CENTER = { lat: 12.61, lng: 102.104 };

function jitter(meters: number) {
  // ~1° latitude ≈ 111_320m. Random offset within ±meters in both axes.
  const offsetDeg = (Math.random() * 2 - 1) * (meters / 111320);
  return offsetDeg;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("Resetting tables...");
  await prisma.fruitBatch.deleteMany();
  await prisma.inspection.deleteMany();
  await prisma.tree.deleteMany();
  await prisma.worker.deleteMany();

  console.log("Seeding workers...");
  const workers = await Promise.all(
    [
      { id: "WORKER-001", name: "สมชาย ใจดี", phone: "0812345001" },
      { id: "WORKER-002", name: "สมหญิง รักสวน", phone: "0812345002" },
      { id: "WORKER-003", name: "มานี มั่นคง", phone: "0812345003" },
      { id: "WORKER-004", name: "ปิติ ขยัน", phone: "0812345004" },
      { id: "WORKER-005", name: "วิภา สุขใจ", phone: "0812345005" },
    ].map((w) => prisma.worker.create({ data: w })),
  );

  console.log("Seeding trees...");
  const zones = ["A", "B", "C", "D", "E"];
  const varieties = ["Chanee", "Monthong"];
  const trees = await Promise.all(
    Array.from({ length: 20 }, (_, i) => {
      const id = `TREE-${String(i + 1).padStart(3, "0")}`;
      const zone = zones[i % zones.length];
      const variety = varieties[i % varieties.length];
      // Trees planted between 3 and 8 years ago.
      const yearsOld = 3 + (i % 6);
      return prisma.tree.create({
        data: {
          id,
          zone,
          variety,
          plantedDate: daysAgo(yearsOld * 365),
          latitude: FARM_CENTER.lat + jitter(80),
          longitude: FARM_CENTER.lng + jitter(80),
        },
      });
    }),
  );

  console.log("Seeding inspections...");
  // A few historical inspections so the history view + dashboard have data,
  // and so the notification rules have something to derive from.
  type SeedInsp = {
    treeIdx: number;
    workerIdx: number;
    daysAgo: number;
    grade: "A" | "B" | "C";
    flowers: number | null;
    fruits: number | null;
    issues: string[];
    notes?: string;
    fertilizerApplied?: boolean;
    pesticideApplied?: boolean;
  };

  const seedInspections: SeedInsp[] = [
    // TREE-001 — healthy, fertilized recently
    { treeIdx: 0, workerIdx: 0, daysAgo: 2, grade: "A", flowers: 12, fruits: 4, issues: [], fertilizerApplied: true },
    // TREE-002 — pest issue, no follow-up yet → should trigger pesticide_needed
    { treeIdx: 1, workerIdx: 1, daysAgo: 3, grade: "B", flowers: 8, fruits: 2, issues: ["เพลี้ย"], notes: "พบเพลี้ยที่ใบอ่อน" },
    // TREE-003 — pest issue THEN later inspection with pesticide applied → no alert
    { treeIdx: 2, workerIdx: 1, daysAgo: 10, grade: "B", flowers: 5, fruits: 1, issues: ["แมลงศัตรูพืช"] },
    { treeIdx: 2, workerIdx: 2, daysAgo: 4, grade: "A", flowers: 6, fruits: 1, issues: [], pesticideApplied: true, notes: "ฉีดยาตามแผน" },
    // TREE-004 — old fertilizer (>30 days ago) → fertilizer_overdue
    { treeIdx: 3, workerIdx: 0, daysAgo: 45, grade: "A", flowers: 10, fruits: 3, issues: [], fertilizerApplied: true },
    { treeIdx: 3, workerIdx: 3, daysAgo: 5, grade: "B", flowers: 11, fruits: 3, issues: ["ใบเหลือง"] },
    // TREE-005 — grade C, recent
    { treeIdx: 4, workerIdx: 4, daysAgo: 1, grade: "C", flowers: 2, fruits: 0, issues: ["โรครา", "รากเน่า"], notes: "ต้องดูแลด่วน" },
    // TREE-006 — grade C from a few days ago
    { treeIdx: 5, workerIdx: 2, daysAgo: 6, grade: "C", flowers: 0, fruits: 0, issues: ["ขาดน้ำ"] },
    // TREE-007 — fine
    { treeIdx: 6, workerIdx: 3, daysAgo: 2, grade: "A", flowers: 14, fruits: 5, issues: [], fertilizerApplied: true },
  ];

  for (const s of seedInspections) {
    await prisma.inspection.create({
      data: {
        treeId: trees[s.treeIdx].id,
        workerId: workers[s.workerIdx].id,
        healthGrade: s.grade,
        flowerCount: s.flowers,
        fruitCount: s.fruits,
        issuesFound: JSON.stringify(s.issues),
        notes: s.notes ?? null,
        fertilizerApplied: s.fertilizerApplied ?? false,
        pesticideApplied: s.pesticideApplied ?? false,
        latitude: trees[s.treeIdx].latitude,
        longitude: trees[s.treeIdx].longitude,
        createdAt: daysAgo(s.daysAgo),
      },
    });
  }

  console.log("Seeding fruit batches...");
  // Mix of states: ready to harvest, almost ready, freshly bloomed, already harvested.
  const seedBatches: Array<{
    treeIdx: number;
    color: "red" | "green" | "blue";
    bloomDaysAgo: number;
    harvestedDaysAgo?: number;
    harvestedByIdx?: number;
  }> = [
    // TREE-001: red ready (125 days), green almost-ready (115 days)
    { treeIdx: 0, color: "red", bloomDaysAgo: 125 },
    { treeIdx: 0, color: "green", bloomDaysAgo: 115 },
    // TREE-002: blue overdue
    { treeIdx: 1, color: "blue", bloomDaysAgo: 130 },
    // TREE-003: red just bloomed
    { treeIdx: 2, color: "red", bloomDaysAgo: 5 },
    // TREE-004: green ready
    { treeIdx: 3, color: "green", bloomDaysAgo: 122 },
    // TREE-005: red harvested last month (frees up the color)
    { treeIdx: 4, color: "red", bloomDaysAgo: 150, harvestedDaysAgo: 20, harvestedByIdx: 0 },
    // TREE-007: blue mid-cycle
    { treeIdx: 6, color: "blue", bloomDaysAgo: 60 },
  ];

  for (const b of seedBatches) {
    await prisma.fruitBatch.create({
      data: {
        treeId: trees[b.treeIdx].id,
        colorTag: b.color,
        bloomDate: daysAgo(b.bloomDaysAgo),
        harvestedAt: b.harvestedDaysAgo != null ? daysAgo(b.harvestedDaysAgo) : null,
        harvestedById:
          b.harvestedByIdx != null ? workers[b.harvestedByIdx].id : null,
      },
    });
  }

  console.log(
    `Seeded ${workers.length} workers, ${trees.length} trees, ${seedInspections.length} inspections, ${seedBatches.length} fruit batches.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
