"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { QrScanner } from "@/components/worker/QrScanner";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage } from "@/lib/i18n/labels";

const RECENT_KEY = "recent_trees";
const RECENT_MAX = 5;

function readRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]").slice(0, RECENT_MAX); } catch { return []; }
}
function rememberTree(id: string) {
  try {
    const next = [id, ...readRecent().filter((t) => t !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage blocked — recents are a convenience only */ }
}

export default function ScanPage() {
  const router = useRouter();
  const { lang, tr } = useT();
  const [manualId, setManualId] = useState("");
  const [checking, setChecking] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);

  const navigateToTree = useCallback(
    async (qrValue: string, scannedAt: string) => {
      if (checking || scanned) return;
      setChecking(true);

      try {
        const res = await fetch(`/api/trees/${encodeURIComponent(qrValue)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          toast.error(res.status === 404 ? tr("scanNotFound") : errorMessage(body, lang));
          setChecking(false);
          return;
        }
        const { tree } = await res.json();
        setScanned(true);
        rememberTree(tree.tree_id);
        sessionStorage.setItem("qr_scanned_at", scannedAt);
        sessionStorage.setItem("qr_value", qrValue);
        router.push(`/tree/${tree.tree_id}`);
      } catch {
        toast.error(tr("err_network"));
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
    // No toUpperCase: a pasted QR payload ("QR_AL1-1_v1") is case-sensitive. The API
    // upper-cases plain tree IDs itself.
    await navigateToTree(manualId.trim(), new Date().toISOString());
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader variant="home" />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        <Link
          href="/my-logs"
          className="mb-4 flex h-15 items-center justify-center gap-2 rounded-lg border border-line bg-surface text-base font-semibold text-body active:bg-surface-alt"
        >
          <span>📋</span>
          <span>{tr("myLogsNavLabel")}</span>
        </Link>

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

        <form onSubmit={handleManualSubmit} className="space-y-2">
          <label htmlFor="manual-tree-id" className="block text-base font-semibold text-body">{tr("treeIdLabel")}</label>
          <div className="flex gap-2">
            <input
              id="manual-tree-id"
              type="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              placeholder="AL13-7"
              className="h-15 min-w-0 flex-1 rounded-lg border border-line px-4 font-mono text-lg focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={!manualId.trim() || checking}
              className="h-15 rounded-lg bg-primary px-5 text-lg font-semibold text-white disabled:bg-surface-press"
            >
              {tr("scanSearch")}
            </button>
          </div>
          <p className="text-sm text-muted">ⓘ {tr("manualEntryNotice")}</p>
        </form>

        {recent.length > 0 && (
          <div>
            <p className="mb-2 text-base font-semibold text-body">{tr("recentTreesTitle")}</p>
            <div className="flex flex-wrap gap-2">
              {recent.map((id) => (
                <Link
                  key={id}
                  href={`/tree/${id}`}
                  onClick={() => { sessionStorage.setItem("qr_scanned_at", new Date().toISOString()); sessionStorage.setItem("qr_value", id); }}
                  className="inline-flex min-h-15 items-center rounded-lg border border-line bg-surface px-4 font-mono text-lg font-semibold text-ink active:bg-surface-alt"
                >
                  {id}
                </Link>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
