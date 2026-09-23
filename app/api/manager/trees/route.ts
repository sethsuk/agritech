import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/requireStaff";
import { parseTreeId, qrCodeForTreeId } from "@/lib/treeId";

// POST /api/manager/trees — create a new tree. Requires manager or owner role.

const CreateTreeSchema = z.object({
  treeId: z.string().min(1),
  lat: z.number(),
  long: z.number(),
  variety: z.string().min(1),
  plantedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = CreateTreeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { treeId: rawTreeId, lat, long, variety, plantedDate } = parsed.data;
  const treeId = rawTreeId.trim().toUpperCase();

  const parsedId = parseTreeId(treeId);
  if (!parsedId) {
    return NextResponse.json(
      { error: "invalid_tree_id", detail: "รูปแบบรหัสต้นไม้ไม่ถูกต้อง เช่น AL13-7" },
      { status: 400 },
    );
  }

  const { data: existing } = await admin
    .from("trees")
    .select("tree_id")
    .eq("tree_id", treeId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "duplicate_tree_id", detail: `มีต้นไม้รหัส ${treeId} อยู่แล้ว` },
      { status: 409 },
    );
  }

  const { data: tree, error } = await admin
    .from("trees")
    .insert({
      tree_id: treeId,
      qr_code: qrCodeForTreeId(treeId),
      lat,
      long,
      zone: parsedId.zone,
      side: parsedId.side,
      row_num: parsedId.rowNum,
      position: parsedId.position,
      variety,
      planted_date: plantedDate,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !tree) {
    console.error("tree insert error:", error);
    return NextResponse.json({ error: "Failed to create tree" }, { status: 500 });
  }

  return NextResponse.json({ tree });
}
