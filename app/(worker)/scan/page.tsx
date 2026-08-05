"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QrScanner } from "@/components/worker/QrScanner";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { useLang } from "@/lib/i18n/LanguageContext";
import { t } from "@/lib/i18n/t";
import { dict } from "@/lib/i18n/dictionary";

export default function ScanPage() {
  const router = useRouter();
  const { lang } = useLang();
  const [manualId, setManualId] = useState("");
  const [checking, setChecking] = useState(false);
  const [scanned, setScanned] = useState(false);

  const tr = (key: keyof typeof dict) => t(dict[key], lang);

  const navigateToTree = useCallback(
    async (qrValue: string, scannedAt: string) => {
      if (checking || scanned) return;
      setChecking(true);

      try {
        const res = await fetch(`/api/trees/${encodeURIComponent(qrValue)}`);
        if (!res.ok) {
          toast.error(tr("scanNotFound"));
          setChecking(false);
          return;
        }
        const { tree } = await res.json();
        setScanned(true);
        sessionStorage.setItem("qr_scanned_at", scannedAt);
        sessionStorage.setItem("qr_value", qrValue);
        router.push(`/tree/${tree.tree_id}`);
      } catch {
        toast.error(tr("scanError"));
        setChecking(false);
      }
    },
    [router, checking, scanned, lang], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleQrDecode = useCallback(
    (text: string) => {
      const scannedAt = new Date().toISOString();
      navigateToTree(text, scannedAt);
    },
    [navigateToTree],
  );

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualId.trim()) return;
    await navigateToTree(manualId.trim().toUpperCase(), new Date().toISOString());
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader variant="home" />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        <p className="mb-4 text-lg text-muted">{tr("scanPrompt")}</p>
        <div className="flex-1 space-y-4">
        <QrScanner
          onDecode={handleQrDecode}
          onUnavailable={() => toast.info(tr("cameraUnavailableToast"))}
        />

        {checking && (
          <div className="rounded-lg bg-primary-tint p-4 text-center text-lg text-primary-ink">
            {tr("scanning")}
          </div>
        )}

        <div className="relative flex items-center py-2">
          <div className="flex-1 border-t border-line" />
          <span className="mx-3 text-base text-muted">{tr("scanOr")}</span>
          <div className="flex-1 border-t border-line" />
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="A-001"
            className="h-12 flex-1 rounded-lg border border-line px-4 text-base uppercase focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualId.trim() || checking}
            className="h-12 rounded-lg bg-primary px-5 text-lg font-semibold text-white disabled:bg-surface-press"
          >
            {tr("scanSearch")}
          </button>
        </form>
        </div>
      </main>
    </div>
  );
}
