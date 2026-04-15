import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_GRADES = new Set(["A", "B", "C"]);

type Body = {
  treeId?: string;
  workerId?: string;
  healthGrade?: string;
  flowerCount?: number | null;
  fruitCount?: number | null;
  issuesFound?: string[];
  notes?: string | null;
  photoUrls?: string[];
  latitude?: number | null;
  longitude?: number | null;
  fertilizerApplied?: boolean;
  pesticideApplied?: boolean;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON ไม่ถูกต้อง" }, { status: 400 });
  }

  if (!body.treeId || !body.workerId) {
    return NextResponse.json(
      { error: "ต้องระบุ treeId และ workerId" },
      { status: 400 },
    );
  }
  if (!body.healthGrade || !VALID_GRADES.has(body.healthGrade)) {
    return NextResponse.json(
      { error: "กรุณาเลือกสุขภาพต้น (A, B, หรือ C)" },
      { status: 400 },
    );
  }

  // Make sure the tree exists; gives a friendlier error than a foreign-key violation.
  const tree = await prisma.tree.findUnique({ where: { id: body.treeId }, select: { id: true } });
  if (!tree) {
    return NextResponse.json({ error: "ไม่พบต้นไม้รหัสนี้" }, { status: 404 });
  }

  const inspection = await prisma.inspection.create({
    data: {
      treeId: body.treeId,
      workerId: body.workerId,
      healthGrade: body.healthGrade,
      flowerCount: body.flowerCount ?? null,
      fruitCount: body.fruitCount ?? null,
      issuesFound: JSON.stringify(body.issuesFound ?? []),
      notes: body.notes ?? null,
      photoUrls:
        body.photoUrls && body.photoUrls.length > 0
          ? JSON.stringify(body.photoUrls)
          : null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      fertilizerApplied: body.fertilizerApplied ?? false,
      pesticideApplied: body.pesticideApplied ?? false,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: inspection.id }, { status: 201 });
}

function startOfRange(range: string | null): Date | null {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("workerId") ?? undefined;
  const date = searchParams.get("date");
  const healthGrade = searchParams.get("healthGrade") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 500);

  const where: Prisma.InspectionWhereInput = {};
  if (workerId) where.workerId = workerId;
  if (healthGrade) where.healthGrade = healthGrade;
  const since = startOfRange(date);
  if (since) where.createdAt = { gte: since };

  const rows = await prisma.inspection.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      tree: { select: { id: true, zone: true, variety: true } },
      worker: { select: { id: true, name: true } },
    },
  });

  const enriched = rows.map((r) => ({
    id: r.id,
    treeId: r.treeId,
    tree: r.tree,
    worker: r.worker,
    healthGrade: r.healthGrade,
    flowerCount: r.flowerCount,
    fruitCount: r.fruitCount,
    issuesFound: safeParse(r.issuesFound),
    notes: r.notes,
    photoUrls: r.photoUrls ? safeParse(r.photoUrls) : [],
    latitude: r.latitude,
    longitude: r.longitude,
    fertilizerApplied: r.fertilizerApplied,
    pesticideApplied: r.pesticideApplied,
    createdAt: r.createdAt,
  }));

  return NextResponse.json(enriched);
}

function safeParse(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
