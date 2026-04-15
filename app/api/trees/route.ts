import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const zone = searchParams.get("zone") ?? undefined;

  const trees = await prisma.tree.findMany({
    where: zone ? { zone } : undefined,
    orderBy: { id: "asc" },
    include: {
      inspections: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { healthGrade: true, createdAt: true },
      },
    },
  });

  const enriched = trees.map((t) => ({
    id: t.id,
    zone: t.zone,
    variety: t.variety,
    plantedDate: t.plantedDate,
    latitude: t.latitude,
    longitude: t.longitude,
    latestGrade: t.inspections[0]?.healthGrade ?? null,
    lastInspectionAt: t.inspections[0]?.createdAt ?? null,
  }));

  return NextResponse.json(enriched);
}
