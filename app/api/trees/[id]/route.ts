import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const tree = await prisma.tree.findUnique({
    where: { id },
    include: {
      inspections: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, healthGrade: true },
      },
      fruitBatches: {
        where: { harvestedAt: null },
        orderBy: { bloomDate: "asc" },
        select: { id: true, colorTag: true, bloomDate: true, notes: true },
      },
    },
  });

  if (!tree) {
    return NextResponse.json({ error: "ไม่พบต้นไม้รหัสนี้" }, { status: 404 });
  }

  return NextResponse.json({
    id: tree.id,
    zone: tree.zone,
    variety: tree.variety,
    plantedDate: tree.plantedDate,
    latitude: tree.latitude,
    longitude: tree.longitude,
    lastInspectionAt: tree.inspections[0]?.createdAt ?? null,
    lastInspectionGrade: tree.inspections[0]?.healthGrade ?? null,
    activeFruitBatches: tree.fruitBatches,
  });
}
