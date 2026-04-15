import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { PHOTO_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB safety cap (post-compression should be ~300KB)

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "ข้อมูลฟอร์มไม่ถูกต้อง" }, { status: 400 });
  }

  const file = formData.get("file");
  const treeId = (formData.get("treeId") as string | null)?.trim() || "misc";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "ไม่พบไฟล์รูปภาพ" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "ไฟล์รูปภาพใหญ่เกินไป" }, { status: 413 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "รองรับเฉพาะไฟล์รูปภาพ" }, { status: 400 });
  }

  const safeTreeId = treeId.replace(/[^A-Z0-9_-]/gi, "_");
  const path = `${safeTreeId}/${randomUUID()}.jpg`;
  const arrayBuffer = await file.arrayBuffer();

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, arrayBuffer, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      { error: `อัปโหลดไม่สำเร็จ: ${error.message}` },
      { status: 500 },
    );
  }

  const { data: publicUrlData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(path);

  return NextResponse.json({ url: publicUrlData.publicUrl, path });
}
