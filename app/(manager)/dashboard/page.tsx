"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/LanguageContext";
import { alertSubtypeLabel, colorName, COLOR_ICON, flagLabel, taskLabel } from "@/lib/i18n/labels";
import { useOverview, useTaskDefs, type Overview } from "@/lib/client/queries";
import { parseZoneKey, zoneKey } from "@/lib/treeId";
import { daysSince, formatDate, formatDateTime, RANGE_KEYS, type RangeKey } from "@/lib/time";
import { ALERT_CATEGORY_ICON, ALERT_TIER, chipClass, validationBadgeClass } from "@/lib/ui/badges";
import { InfoTip } from "@/components/InfoTip";
import { ErrorState, RefreshBar } from "@/components/QueryState";
import type { DictKey } from "@/lib/i18n/dictionary";

const RANGE_LABEL: Record<RangeKey, DictKey> = {
  today: "rangeToday", week: "rangeWeek", month: "rangeMonth", year: "rangeYear", all: "rangeAll",
};
const GRADE_ORDER = ["A", "B", "C", "reject"];

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}

/**
 * Manager overview. The whole snapshot is fetched ONCE (one DB round trip) and cached;
 * zone and range filters are pure client-side selection over pre-grouped numbers, so
 * switching them is instant. Filters live in the URL so Back returns to the same view.
 */
function Dashboard() {
  const { lang, tr } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const overview = useOverview();
  const taskDefs = useTaskDefs();

  const zone = parseZoneKey(params.get("zone")) ? params.get("zone")! : null;
  const range: RangeKey = (RANGE_KEYS as string[]).includes(params.get("range") ?? "")
    ? (params.get("range") as RangeKey)
    : "week";

  const setFilter = (next: { zone?: string | null; range?: RangeKey }) => {
    const qs = new URLSearchParams(params);
    if (next.zone !== undefined) next.zone ? qs.set("zone", next.zone) : qs.delete("zone");
    if (next.range) qs.set("range", next.range);
    router.replace(`/dashboard?${qs}`, { scroll: false });
  };

  const view = useMemo(() => (overview.data ? select(overview.data, zone, range) : null), [overview.data, zone, range]);

  // Query string the tiles carry to the Logs page, so it opens on the same slice.
  const sliceQs = new URLSearchParams({ range, ...(zone ? { zone } : {}) }).toString();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">{tr("dashboardTitle")}</h1>
        <RefreshBar
          updatedAt={overview.dataUpdatedAt || undefined}
          fetching={overview.isFetching}
          onRefresh={() => overview.refetch()}
        />
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr("zoneLabel")}>
          <button type="button" aria-pressed={zone === null} onClick={() => setFilter({ zone: null })} className={chipClass(zone === null)}>
            {tr("filterZoneAll")}
          </button>
          {overview.data?.zones.map((z) => {
            const key = zoneKey(z.zone, z.side);
            return (
              <button key={key} type="button" aria-pressed={zone === key} onClick={() => setFilter({ zone: key })} className={chipClass(zone === key)}>
                {key}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr("filterRange")}>
          {RANGE_KEYS.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => setFilter({ range: r })} className={chipClass(range === r)}>
              {tr(RANGE_LABEL[r])}
            </button>
          ))}
        </div>
      </div>

      {overview.isError && !overview.data && (
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      )}

      {/* Stat tiles */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {!view
          ? !overview.isError && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-alt" />
            ))
          : [
              { label: tr("statOpenAlerts"), help: tr("help_openAlerts"), value: view.openAlerts, color: "text-caution-ink", href: "/alerts" },
              { label: tr("statUrgentAlerts"), help: tr("help_urgentAlerts"), value: view.urgentAlerts, color: "text-warning-ink", href: "/alerts?tier=tier_1" },
              { label: tr("statLogsLabel"), help: tr("help_logs"), value: view.logs, color: "text-primary-ink", href: `/logs?${sliceQs}` },
              { label: tr("statFruitHarvested"), help: tr("help_fruit"), value: view.fruitTotal, color: "text-status-ink", href: `/logs?${sliceQs}&task=harvest` },
              {
                label: tr("statStaleTrees", { n: overview.data!.staleDays }),
                help: tr("help_staleTrees", { n: overview.data!.staleDays }),
                value: view.staleCount, color: "text-caution-ink",
                href: `/trees?stale=1${zone ? `&zone=${zone}` : ""}`,
              },
              { label: tr("statOverdueSets"), help: tr("help_overdueSets"), value: view.overdueSets.length, color: "text-warning-ink", href: "#overdue-sets" },
            ].map(({ label, help, value, color, href }) => (
              <div key={label} className="relative rounded-lg border border-line bg-surface">
                <Link href={href} className="block h-full rounded-lg p-4 pr-10 active:bg-surface-alt">
                  <p className="text-xs leading-snug text-muted">{label}</p>
                  <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
                </Link>
                <span className="absolute right-2 top-2">
                  <InfoTip text={help} label={label} />
                </span>
              </div>
            ))}
      </div>

      {view && view.fruitTotal > 0 && (
        <div className="mb-8 flex flex-wrap gap-2" aria-label={tr("gradeSummaryTitle")}>
          {view.fruitByGrade.map(([grade, count]) => (
            <span key={grade} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-body">
              {grade === "reject" ? tr("gradeLabelReject") : grade}: {count} {tr("fruitCountUnit")}
            </span>
          ))}
        </div>
      )}

      {view && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title={tr("staleTreesTitle", { n: overview.data!.staleDays })} empty={tr("noStaleTrees")} count={view.staleTrees.length}>
            {view.staleTrees.map((tree) => {
              const days = daysSince(tree.last_log_at);
              return (
                <Row key={tree.tree_id} href={`/trees/${tree.tree_id}`} title={tree.tree_id} subtitle={zoneKey(tree.zone, tree.side)}>
                  <span className="rounded-full bg-caution-tint px-2 py-0.5 text-xs font-semibold text-caution-ink">
                    {days !== null ? `${days} ${tr("daysAgoSuffix")}` : tr("neverLoggedYet")}
                  </span>
                </Row>
              );
            })}
          </Section>

          <Section id="overdue-sets" title={tr("overdueSetsTitle")} empty={tr("noOverdueSets")} count={view.overdueSets.length}>
            {view.overdueSets.map((set) => (
              <Row
                key={set.set_id}
                href={`/trees/${set.tree_id}`}
                title={`${set.tree_id} · ${COLOR_ICON[set.color] ?? ""} ${colorName(set.color, lang)}`}
                subtitle={`${tr("setRemaining", { n: Math.max(set.remaining, 0) })} · ${formatDate(set.harvest_window_end, lang)}`}
              >
                <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-ink">
                  {daysSince(`${set.harvest_window_end}T23:59:59+07:00`) ?? 0} {tr("overdueByDaysSuffix")}
                </span>
              </Row>
            ))}
          </Section>

          <Section
            title={tr("recentAlertsTitle")}
            empty={tr("noOpenAlerts")}
            count={view.recentAlerts.length}
            action={<Link href="/alerts" className="inline-flex min-h-11 items-center text-sm text-primary-ink hover:underline sm:min-h-0">{tr("viewAll")} →</Link>}
          >
            {view.recentAlerts.map((alert) => {
              const tier = ALERT_TIER[alert.tier];
              return (
                <Row
                  key={alert.alert_id}
                  href="/alerts"
                  icon={ALERT_CATEGORY_ICON[alert.category] ?? "📌"}
                  title={`${alertSubtypeLabel(alert.subtype, lang)}${alert.tree_id ? ` · ${alert.tree_id}` : ""}`}
                  subtitle={formatDateTime(alert.created_at, lang)}
                >
                  {tier && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tier.className}`}>{tr(tier.key)}</span>}
                </Row>
              );
            })}
          </Section>

          <Section
            title={tr("recentLogsTitle")}
            empty={tr("noLogsYet")}
            count={view.recentLogs.length}
            action={<Link href={`/logs?${sliceQs}`} className="inline-flex min-h-11 items-center text-sm text-primary-ink hover:underline sm:min-h-0">{tr("viewAll")} →</Link>}
          >
            {view.recentLogs.map((log) => (
              <Row
                key={log.log_id}
                href={`/logs/${log.log_id}`}
                title={`${log.tree_id} · ${taskLabel(log.task_def_id, taskDefs.data, lang)}`}
                subtitle={`${formatDateTime(log.submitted_at, lang)}${log.worker_name ? ` · ${log.worker_name}` : ""}`}
              >
                {log.validation_status === "flagged" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${validationBadgeClass("flagged")}`}>
                    {log.validation_flags[0] ? flagLabel(log.validation_flags[0], lang) : tr("validationFlagged")}
                  </span>
                )}
              </Row>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

/** Narrow the pre-grouped snapshot to one zone (or all) and one range. Pure. */
function select(o: Overview, zone: string | null, range: RangeKey) {
  const z = parseZoneKey(zone);
  const inZone = (r: { zone: string | null; side: string | null }) => !z || (r.zone === z.zone && r.side === z.side);

  const logs = o.logCounts.filter(inZone).reduce((n, r) => n + Number(r[range]), 0);

  const grades = new Map<string, number>();
  for (const f of o.fruit.filter(inZone)) grades.set(f.grade, (grades.get(f.grade) ?? 0) + Number(f[range]));
  const fruitByGrade = [...grades.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => GRADE_ORDER.indexOf(a[0]) - GRADE_ORDER.indexOf(b[0]));

  const alerts = o.alerts.filter((a) => !z || inZone(a));
  const since = range === "all" ? null : o.bounds[range];

  return {
    logs,
    fruitByGrade,
    fruitTotal: fruitByGrade.reduce((n, [, c]) => n + c, 0),
    openAlerts: alerts.length,
    urgentAlerts: alerts.filter((a) => a.tier === "tier_1").length,
    recentAlerts: alerts.slice(0, 10),
    staleCount: o.staleCounts.filter(inZone).reduce((n, r) => n + Number(r.count), 0),
    staleTrees: o.staleTrees.filter(inZone).slice(0, 20),
    overdueSets: o.overdueSets.filter(inZone),
    recentLogs: o.recentLogs
      .filter(inZone)
      .filter((l) => !since || l.submitted_at >= since)
      .slice(0, 20),
  };
}

function Section({
  id, title, empty, count, action, children,
}: { id?: string; title: string; empty: string; count: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="space-y-2">
        {count === 0 ? (
          <div className="rounded-lg border border-line bg-surface p-6 text-center text-sm text-muted">{empty}</div>
        ) : children}
      </div>
    </section>
  );
}

function Row({
  href, title, subtitle, icon, children,
}: { href: string; title: string; subtitle?: string; icon?: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 active:bg-surface-alt">
      {icon && <span aria-hidden className="text-xl">{icon}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {children}
    </Link>
  );
}
