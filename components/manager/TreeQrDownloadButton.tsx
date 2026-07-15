"use client";

import { downloadTreeQrLabel } from "@/lib/qrLabel";

export function TreeQrDownloadButton({ treeId, qrCode }: { treeId: string; qrCode: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadTreeQrLabel(treeId, qrCode);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      aria-label={`ดาวน์โหลด QR ${treeId}`}
      title="ดาวน์โหลด QR"
    >
      📥
    </button>
  );
}
