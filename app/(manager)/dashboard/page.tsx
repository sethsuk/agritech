"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict, type DictKey } from "@/lib/i18n/dictionary";
import type { DbAlert, DbTaskLog } from "@/types/database";

type RangeKey = "today" | "week" | "month" | "year" | "all";

interface OverviewData {
  zones: string[];
  range: RangeKey;
  openAlertsCount: number;
  tier1AlertsCount: number;
  logsInRangeCount: number;
  fruitTotalInRange: number;
  fruitByGrade: Record<string, number>;
  recentAlerts: (DbAlert & { trees?: { tree_id: string; zone: string }; workers?: { users: { display_name: string } } })[];
  recentLogs: Pick<DbTaskLog, "log_id" | "tree_id" | "task_type" | "worker_id" | "submitted_at" | "validation_status" | "validation_flags">[];
}

// Must stay in sync with tierBadge in app/(manager)/alerts/page.tsx — the same
// alert should not read as urgent in one place and mild in another.
const tierMeta: Record<string, { key: DictKey; color: string }> = {
  tier_1: { key: "alertTierUrgent", color: "bg-warning text-white" },
  tier_2: { key: "alertTierModerate", color: "bg-caution text-white" },
  tier_3: { key: "alertTierInfo", color: "bg-surface-alt text-body border border-line" },
};

const categoryIcon: Record<string, string> = {
  farm_health: "🌿",
  fraud_signal: "⚠️",
  inactivity: "😴",
  compliance: "📋",
};

const RANGES: { value: RangeKey; key: DictKey }[] = [
  { value: "today", key: "rangeToday" },
  { value: "week", key: "rangeWeek" },
  { value: "month", key: "rangeMonth" },
  { value: "year", key: "rangeYear" },
  { value: "all", key: "rangeAll" },
];

const GRADE_ORDER = ["A", "B", "C", "reject"];

export default function ManagerDashboard() {
  const { lang } = useLang();
  const [data, setData] = useState<OverviewData | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("week");

  const tr = (key: DictKey) => t(dict[key], lang);

  useEffect(() => {
    const qs = new URLSearchParams({ range });
    if (zone) qs.set("zone", zone);
    fetch(`/api/manager/overview?${qs}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => toast.error(tr("loadOverviewError")));
  }, [zone, range]); // eslint-disable-line react-hooks/exhaustive-deps

  const statCards: { label: string; value: number; color: string; href: string | null }[] = data
    ? [
        { label: tr("statOpenAlerts"), value: data.openAlertsCount, color: "text-warning-ink", href: "/alerts" },
        { label: tr("statUrgentAlerts"), value: data.tier1AlertsCount, color: "text-caution-ink", href: "/alerts" },
        { label: tr("statLogsLabel"), value: data.logsInRangeCount, color: "text-primary-ink", href: null },
        { label: tr("statFruitHarvested"), value: data.fruitTotalInRange, color: "text-status-ink", href: null },
      ]
    : [];

  const gradeEntries = data
    ? Object.entries(data.fruitByGrade).sort(
        (a, b) => GRADE_ORDER.indexOf(a[0]) - GRADE_ORDER.indexOf(b[0])
      )
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-ink">{tr("dashboardTitle")}</h1>

      {/* Filters */}
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setZone(null)}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold sm:min-h-0 sm:py-1.5 ${
              zone === null ? "bg-primary text-white" : "bg-surface text-body border border-line"
            }`}
          >
            {tr("filterZoneAll")}
          </button>
          {data?.zones.map((z) => (
            <button
              key={z}
              onClick={() => setZone(z)}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold sm:min-h-0 sm:py-1.5 ${
                zone === z ? "bg-primary text-white" : "bg-surface text-body border border-line"
              }`}
            >
              {z}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg bg-surface-alt p-1 sm:inline-flex sm:w-auto">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition sm:min-h-0 sm:py-1.5 ${
                range === r.value ? "bg-surface text-ink border border-line" : "text-muted"
              }`}
            >
              {tr(r.key)}
            </button>
          ))}
        </div>
      </div>

      {/* Stat tiles */}
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {data === null
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-alt" />
            ))
          : statCards.map(({ label, value, color, href }) => {
              const inner = (
                <div className="rounded-lg bg-surface p-4 border border-line">
                  <p className="text-xs text-muted">{label}</p>
                  <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
                </div>
              );
              return href ? (
                <Link key={label} href={href}>{inner}</Link>
              ) : (
                <div key={label}>{inner}</div>
              );
            })}
      </div>

      {/* Fruit-by-grade breakdown */}
      {data !== null && data.fruitTotalInRange > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {gradeEntries.map(([grade, count]) => (
            <span key={grade} className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-body border border-line">
              {grade === "reject" ? tr("gradeLabelReject") : grade}: {count} {tr("fruitCountUnit")}
            </span>
          ))}
        </div>
      )}
      {data === null && <div className="mb-8 h-8" />}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent alerts */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-ink">{tr("recentAlertsTitle")}</h2>
            <Link href="/alerts" className="inline-flex min-h-11 items-center text-sm text-primary-ink hover:underline sm:min-h-0">
              {tr("viewAll")} →
            </Link>
          </div>
          <div className="space-y-2">
            {data === null && (
              <div className="h-32 animate-pulse rounded-lg bg-surface-alt" />
            )}
            {data?.recentAlerts.length === 0 && (
              <div className="rounded-lg bg-surface p-6 text-center text-sm text-muted border border-line">
                {tr("noOpenAlerts")}
              </div>
            )}
            {data?.recentAlerts.map((alert) => {
              const meta = tierMeta[alert.tier] ?? { key: null, color: "bg-surface-alt text-body" };
              const tierText = meta.key ? tr(meta.key) : alert.tier;
              return (
                <div
                  key={alert.alert_id}
                  className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 border border-line"
                >
                  <span className="text-xl">{categoryIcon[alert.category] ?? "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {alert.subtype.replace(/_/g, " ")}
                      {alert.tree_id && ` · ${alert.tree_id}`}
                    </p>
                    <p className="text-xs text-muted">
                      {new Date(alert.created_at).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.color}`}>
                    {tierText}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent logs */}
        <section>
          <h2 className="mb-3 font-semibold text-ink">{tr("recentLogsTitle")}</h2>
          <div className="space-y-2">
            {data === null && (
              <div className="h-32 animate-pulse rounded-lg bg-surface-alt" />
            )}
            {data?.recentLogs.length === 0 && (
              <div className="rounded-lg bg-surface p-6 text-center text-sm text-muted border border-line">
                {tr("noLogsYet")}
              </div>
            )}
            {data?.recentLogs.map((log) => (
              <div
                key={log.log_id}
                className="flex items-center gap-3 rounded-lg bg-surface px-4 py-3 border border-line"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {log.tree_id} · {log.task_type}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(log.submitted_at).toLocaleString("th-TH")}
                  </p>
                </div>
                {log.validation_status !== "passed" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    log.validation_status === "flagged"
                      ? "bg-caution-tint text-caution-ink"
                      : "bg-warning-tint text-warning-ink"
                  }`}>
                    {log.validation_flags?.[0] ?? log.validation_status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
