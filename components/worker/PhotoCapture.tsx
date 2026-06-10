"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  photoUrl: string | null;
  onChange: (url: string | null) => void;
};

const MAX_MB = 10;

export function PhotoCapture({ photoUrl, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`รูปใหญ่เกิน ${MAX_MB} MB`);
      return;
    }

    setUploading(true);
    const toastId = toast.loading("กำลังอัปโหลดรูป…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-photo", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "อัปโหลดไม่สำเร็จ");
      }
      const { url } = await res.json() as { url: string };
      onChange(url);
      toast.success("อัปโหลดสำเร็จ", { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "อัปโหลดไม่สำเร็จ";
      toast.error(msg, { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  if (photoUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="รูปที่ถ่าย" className="h-48 w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <>
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
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-400 bg-white text-base font-medium text-amber-800 active:bg-amber-50 disabled:opacity-50"
      >
        {uploading ? "กำลังอัปโหลด..." : "📸 ถ่ายรูป"}
      </button>
    </>
  );
}
