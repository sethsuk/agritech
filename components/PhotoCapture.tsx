"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { compressForUpload } from "@/lib/compressImage";

type Props = {
  treeId: string;
  photoUrls: string[];
  onChange: (urls: string[]) => void;
};

export function PhotoCapture({ treeId, photoUrls, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be picked again
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading("กำลังอัปโหลดรูป…");
    try {
      const compressed = await compressForUpload(file);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("treeId", treeId);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
      }
      const data = (await res.json()) as { url: string };
      onChange([...photoUrls, data.url]);
      toast.success("อัปโหลดสำเร็จ", { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
      toast.error(msg, { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  function removeAt(i: number) {
    onChange(photoUrls.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white text-base font-medium text-slate-700 active:bg-slate-50 disabled:opacity-50"
      >
        {uploading ? "กำลังอัปโหลด..." : "📸 ถ่ายรูป / เลือกรูป"}
      </button>

      {photoUrls.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photoUrls.map((url, i) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`รูปที่ ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="ลบรูป"
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
