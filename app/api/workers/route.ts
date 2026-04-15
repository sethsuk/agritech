import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const workers = await prisma.worker.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true, phone: true },
  });
  return NextResponse.json(workers);
}
