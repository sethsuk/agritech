import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const [trees, inspections, fruitBatches] = await Promise.all([
    prisma.tree.findMany({
      select: { id: true, zone: true, variety: true },
    }),
    prisma.inspection.findMany({
      select: {
        id: true,
        treeId: true,
        healthGrade: true,
        issuesFound: true,
        fertilizerApplied: true,
        pesticideApplied: true,
        createdAt: true,
      },
    }),
    prisma.fruitBatch.findMany({
      select: {
        id: true,
        treeId: true,
        colorTag: true,
        bloomDate: true,
        harvestedAt: true,
      },
    }),
  ]);

  const notifications = deriveNotifications({
    trees,
    inspections,
    fruitBatches,
    now: new Date(),
  });

  return NextResponse.json(notifications);
}
