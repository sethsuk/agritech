"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { t, type Lang } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict, type DictKey } from "@/lib/i18n/dictionary";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { T } from "@/components/T";

interface Manager {
  id: string;
  displayName: string;
  email: string | null;
  active: boolean;
}

const deactivateConfirmText: Record<Lang, (name: string) => string> = {
  th: (name) => `ปิดใช้งาน ${name}? ผู้จัดการคนนี้จะเข้าสู่ระบบไม่ได้อีก`,
  my: (name) => `${name} ကို ပိတ်မလား? ဤမန်နေဂျာသည် နောက်ထပ် လော့ဂ်အင်ဝင်နိုင်တော့မည် မဟုတ်ပါ`,
  en: (name) => `Deactivate ${name}? They will no longer be able to log in`,
};
const reactivateConfirmText: Record<Lang, (name: string) => string> = {
  th: (name) => `เปิดใช้งาน ${name} อีกครั้ง?`,
  my: (name) => `${name} ကို ပြန်လည်အသုံးပြုမလား?`,
  en: (name) => `Reactivate ${name}?`,
};

export function ManagersList() {
  const { lang } = useLang();
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [target, setTarget] = useState<Manager | null>(null);
  const [toggling, setToggling] = useState(false);

  const tr = (key: DictKey) => t(dict[key], lang);

  const load = useCallback(() => {
    fetch("/api/owner/managers")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { managers: Manager[] }) => setManagers(d.managers))
      .catch(() => toast.error(tr("genericErrorToast")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doToggleActive() {
    if (!target) return;
    const deactivating = target.active;
    setToggling(true);
    try {
      const res = await fetch(`/api/owner/managers/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !deactivating }),
      });
      if (!res.ok) {
        toast.error(tr("actionFailedToast"));
        return;
      }
      toast.success(deactivating ? tr("deactivatedManagerToast") : tr("reactivatedManagerToast"));
      setTarget(null);
      load();
    } catch {
      toast.error(tr("genericErrorToast"));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink"><T k="navManagers" /> ({managers?.length ?? 0})</h1>
        <Link
          href="/managers/new"
          className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-press"
        >
          {tr("addManagerButton")}
        </Link>
      </div>

      {managers === null && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />
          ))}
        </div>
      )}

      {managers?.length === 0 && (
        <div className="rounded-lg bg-surface p-8 text-center text-muted border border-line">{tr("noManagersFound")}</div>
      )}

      <div className="space-y-3">
        {managers?.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg bg-surface p-4 border border-line">
            <div>
              <p className="font-semibold text-ink">{m.displayName}</p>
              <p className="text-xs text-muted">{m.email}</p>
              {!m.active && (
                <span className="mt-1 inline-block rounded-full bg-surface-press px-2 py-0.5 text-xs font-semibold text-body">
                  {tr("inactiveBadge")}
                </span>
              )}
            </div>
            <button
              onClick={() => setTarget(m)}
              disabled={toggling}
              className={`h-10 flex-shrink-0 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 ${
                m.active ? "bg-warning-tint text-warning-ink" : "bg-primary-tint text-primary-ink"
              }`}
            >
              {m.active ? tr("deactivateManagerButton") : tr("reactivateManagerButton")}
            </button>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={target !== null}
        title={target?.active ? tr("deactivateManagerTitle") : tr("reactivateManagerTitle")}
        message={
          target
            ? target.active
              ? deactivateConfirmText[lang](target.displayName)
              : reactivateConfirmText[lang](target.displayName)
            : undefined
        }
        confirmLabel={target?.active ? tr("deactivateManagerButton") : tr("reactivateManagerButton")}
        destructive={target?.active}
        onConfirm={doToggleActive}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
