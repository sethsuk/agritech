import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/auth/gate";

const PHOTO_BUCKET = "task-photos";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

/**
 * POST /api/upload-photo
 *
 * Accepts multipart/form-data with a single "file" field. Returns { url, path }.
 * Photos are stored under `<worker id>/` — submit-log only accepts URLs from the
 * submitting worker's own folder. Errors are codes (photo_missing, photo_bad_type,
 * photo_too_large, server_error) mapped to translated text by the client.
 */
export async function POST(request: Request) {
  const gate = await requireWorker();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "photo_missing" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "photo_bad_type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "photo_too_large" }, { status: 400 });
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${userId}/${Date.now()}.${ext}`;

  const { error } = await admin.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("Storage upload error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: publicUrl, path });
}
