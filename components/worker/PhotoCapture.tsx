"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import imageCompression from "browser-image-compression";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";

type Props = {
  photoUrl: string | null;
  onChange: (url: string | null) => void;
};

export function PhotoCapture({ photoUrl, onChange }: Props) {
  const { lang } = useLang();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const toastId = toast.loading(t(dict.photoCompressing, lang));
    try {
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        fileType: "image/jpeg",
      });

      toast.loading(t(dict.photoUploadingToast, lang), { id: toastId });

      const fd = new FormData();
      fd.append("file", compressed, "photo.jpg");
      const res = await fetch("/api/upload-photo", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? t(dict.photoUploadFailed, lang));
      }
      const { url } = await res.json() as { url: string };
      onChange(url);
      toast.success(t(dict.photoUploadSuccess, lang), { id: toastId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t(dict.photoUploadFailed, lang);
      toast.error(msg, { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  if (photoUrl) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt={t(dict.photoAlt, lang)} className="h-48 w-full object-cover" />
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
        {uploading ? t(dict.photoUploading, lang) : t(dict.photoTake, lang)}
      </button>
    </>
  );
}
