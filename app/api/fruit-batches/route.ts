import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

const VALID_COLORS = new Set<string>(config.fruitBatchColors.map((c) => c.id));

type Body = {
  treeId?: string;
  colorTag?: string;
  bloomDate?: string;
  notes?: string | null;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON ไม่ถูกต้อง" }, { status: 400 });
  }

  if (!body.treeId) {
    return NextResponse.json({ error: "ต้องระบุ treeId" }, { status: 400 });
  }
  if (!body.colorTag || !VALID_COLORS.has(body.colorTag)) {
    return NextResponse.json(
      { error: `สีไม่ถูกต้อง (${[...VALID_COLORS].join(", ")})` },
      { status: 400 },
    );
  }
  const bloomDate = body.bloomDate ? new Date(body.bloomDate) : new Date();
  if (Number.isNaN(bloomDate.getTime())) {
    return NextResponse.json({ error: "วันที่ออกดอกไม่ถูกต้อง" }, { status: 400 });
  }

  const existingActive = await prisma.fruitBatch.findFirst({
    where: { treeId: body.treeId, colorTag: body.colorTag, harvestedAt: null },
    select: { id: true },
  });
  if (existingActive) {
    return NextResponse.json(
      { error: "สีนี้ถูกใช้แล้วบนต้นนี้" },
      { status: 409 },
    );
  }

  const created = await prisma.fruitBatch.create({
    data: {
      treeId: body.treeId,
      colorTag: body.colorTag,
      bloomDate,
      notes: body.notes ?? null,
    },
    select: { id: true, colorTag: true, bloomDate: true },
  });

  return NextResponse.json(created, { status: 201 });
}
