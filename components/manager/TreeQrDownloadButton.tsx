"use client";

import { downloadTreeQrLabel } from "@/lib/qrLabel";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";

export function TreeQrDownloadButton({ treeId, qrCode }: { treeId: string; qrCode: string }) {
  const { lang } = useLang();
  const label = t(dict.downloadQr, lang);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadTreeQrLabel(treeId, qrCode);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      aria-label={`${label} ${treeId}`}
      title={label}
    >
      📥
    </button>
  );
}
