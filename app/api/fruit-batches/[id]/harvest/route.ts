import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Body = { workerId?: string };

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON ไม่ถูกต้อง" }, { status: 400 });
  }
  if (!body.workerId) {
    return NextResponse.json({ error: "ต้องระบุ workerId" }, { status: 400 });
  }

  const batch = await prisma.fruitBatch.findUnique({
    where: { id },
    select: { id: true, harvestedAt: true },
  });
  if (!batch) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }
  if (batch.harvestedAt) {
    return NextResponse.json({ error: "เก็บเกี่ยวไปแล้ว" }, { status: 409 });
  }

  const updated = await prisma.fruitBatch.update({
    where: { id },
    data: { harvestedAt: new Date(), harvestedById: body.workerId },
    select: { id: true, harvestedAt: true },
  });

  return NextResponse.json(updated);
}
