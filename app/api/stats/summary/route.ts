import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function safeParseIssues(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [
    totalTrees,
    inspectionsToday,
    weekInspections,
    workers,
  ] = await Promise.all([
    prisma.tree.count(),
    prisma.inspection.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.inspection.findMany({
      where: { createdAt: { gte: weekAgo } },
      select: {
        treeId: true,
        workerId: true,
        healthGrade: true,
        issuesFound: true,
        createdAt: true,
        tree: { select: { zone: true } },
      },
    }),
    prisma.worker.findMany({ select: { id: true, name: true } }),
  ]);

  // Grade distribution this week
  const byHealthGrade: Record<string, number> = { A: 0, B: 0, C: 0 };
  for (const i of weekInspections) {
    byHealthGrade[i.healthGrade] = (byHealthGrade[i.healthGrade] ?? 0) + 1;
  }

  // Per-zone grade breakdown this week
  const byZone: Record<string, { A: number; B: number; C: number }> = {};
  for (const i of weekInspections) {
    const z = i.tree.zone;
    byZone[z] ??= { A: 0, B: 0, C: 0 };
    if (i.healthGrade === "A") byZone[z].A += 1;
    else if (i.healthGrade === "B") byZone[z].B += 1;
    else if (i.healthGrade === "C") byZone[z].C += 1;
  }

  // Top issues this week
  const issueCounts = new Map<string, number>();
  for (const i of weekInspections) {
    for (const issue of safeParseIssues(i.issuesFound)) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }
  const topIssues = [...issueCounts.entries()]
    .map(([issue, count]) => ({ issue, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Worker activity this week
  const workerStats = new Map<
    string,
    { id: string; name: string; count: number; lastActive: Date | null }
  >();
  for (const w of workers) {
    workerStats.set(w.id, { id: w.id, name: w.name, count: 0, lastActive: null });
  }
  for (const i of weekInspections) {
    const ws = workerStats.get(i.workerId);
    if (ws) {
      ws.count += 1;
      if (!ws.lastActive || i.createdAt > ws.lastActive) ws.lastActive = i.createdAt;
    }
  }

  const gradeCWeek = byHealthGrade.C ?? 0;
  const totalWeek = weekInspections.length;
  const percentGradeCWeek =
    totalWeek === 0 ? 0 : Math.round((gradeCWeek / totalWeek) * 100);

  return NextResponse.json({
    totalTrees,
    inspectionsToday,
    inspectionsThisWeek: totalWeek,
    percentGradeCWeek,
    byHealthGrade,
    byZone,
    topIssues,
    workerActivity: [...workerStats.values()].sort((a, b) => b.count - a.count),
  });
}
