import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/requireStaff";

/**
 * GET /api/manager/overview?zone=AL&range=week
 *
 * Aggregated data for the manager dashboard home screen. Both params optional.
 * zone: a zone+side combo like "AL" (omit for all zones).
 * range: "today" | "week" | "month" | "year" | "all" (default "week").
 * Requires manager or owner role.
 */

const RANGES = ["today", "week", "month", "year", "all"] as const;
type Range = (typeof RANGES)[number];

function rangeStart(range: Range): Date | null {
  const now = new Date();
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "all") return null;
  const days = { week: 7, month: 30, year: 365 }[range];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function GET(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range") ?? "week";
  const range: Range = (RANGES as readonly string[]).includes(rangeParam) ? (rangeParam as Range) : "week";

  const zoneParam = searchParams.get("zone");
  const zoneChar = zoneParam && zoneParam.length >= 2 ? zoneParam.slice(0, 1) : null;
  const sideChar = zoneParam && zoneParam.length >= 2 ? zoneParam.slice(1) : null;
  const zoneFilter: { zone: string; side: "L" | "R" } | null =
    zoneChar && (sideChar === "L" || sideChar === "R") ? { zone: zoneChar, side: sideChar } : null;

  const since = rangeStart(range);

  // Available zones for the selector (always unfiltered — the full set of options)
  const { data: zoneRows } = await admin.from("trees").select("zone, side").eq("status", "active");
  const zones = Array.from(new Set((zoneRows ?? []).map((r) => `${r.zone}${r.side}`))).sort();

  // alerts: open count, tier-1 count, recent list — all zone-scoped, NOT time-ranged
  // (open alerts are a current backlog, not a time-series metric)
  let openAlertsQuery = admin.from("alerts").select("*, trees!inner(zone,side)", { count: "exact", head: true }).eq("status", "open");
  let tier1AlertsQuery = admin.from("alerts").select("*, trees!inner(zone,side)", { count: "exact", head: true }).eq("status", "open").eq("tier", "tier_1");
  let recentAlertsQuery = admin.from("alerts")
    .select("alert_id, tier, category, subtype, tree_id, worker_id, created_at, status, trees!inner(zone,side)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(10);

  // task_logs: count + recent list — zone AND range scoped
  let logsCountQuery = admin.from("task_logs").select("*, trees!inner(zone,side)", { count: "exact", head: true });
  let recentLogsQuery = admin.from("task_logs")
    .select("log_id, tree_id, task_type, worker_id, submitted_at, validation_status, validation_flags, trees!inner(zone,side)")
    .order("submitted_at", { ascending: false })
    .limit(20);
  let harvestFormDataQuery = admin.from("task_logs")
    .select("form_data, trees!inner(zone,side)")
    .eq("task_type", "harvest");

  if (since) {
    logsCountQuery = logsCountQuery.gte("submitted_at", since.toISOString());
    recentLogsQuery = recentLogsQuery.gte("submitted_at", since.toISOString());
    harvestFormDataQuery = harvestFormDataQuery.gte("submitted_at", since.toISOString());
  }

  if (zoneFilter) {
    openAlertsQuery = openAlertsQuery.eq("trees.zone", zoneFilter.zone).eq("trees.side", zoneFilter.side);
    tier1AlertsQuery = tier1AlertsQuery.eq("trees.zone", zoneFilter.zone).eq("trees.side", zoneFilter.side);
    recentAlertsQuery = recentAlertsQuery.eq("trees.zone", zoneFilter.zone).eq("trees.side", zoneFilter.side);
    logsCountQuery = logsCountQuery.eq("trees.zone", zoneFilter.zone).eq("trees.side", zoneFilter.side);
    recentLogsQuery = recentLogsQuery.eq("trees.zone", zoneFilter.zone).eq("trees.side", zoneFilter.side);
    harvestFormDataQuery = harvestFormDataQuery.eq("trees.zone", zoneFilter.zone).eq("trees.side", zoneFilter.side);
  }

  const [
    { count: openAlertsCount },
    { count: tier1AlertsCount },
    { count: logsInRangeCount },
    { data: recentAlerts },
    { data: recentLogs },
    { data: harvestLogs },
  ] = await Promise.all([
    openAlertsQuery,
    tier1AlertsQuery,
    logsCountQuery,
    recentAlertsQuery,
    recentLogsQuery,
    harvestFormDataQuery,
  ]);

  // Sum grade_counts across harvest logs in range/zone
  const fruitByGrade: Record<string, number> = {};
  for (const log of harvestLogs ?? []) {
    const gradeCounts = (log.form_data as Record<string, unknown> | null)?.grade_counts;
    if (!gradeCounts || typeof gradeCounts !== "object") continue;
    for (const [grade, count] of Object.entries(gradeCounts as Record<string, unknown>)) {
      const n = Number(count);
      if (!isNaN(n)) fruitByGrade[grade] = (fruitByGrade[grade] ?? 0) + n;
    }
  }
  const fruitTotalInRange = Object.values(fruitByGrade).reduce((sum, n) => sum + n, 0);

  return NextResponse.json({
    zones,
    range,
    openAlertsCount: openAlertsCount ?? 0,
    tier1AlertsCount: tier1AlertsCount ?? 0,
    logsInRangeCount: logsInRangeCount ?? 0,
    fruitTotalInRange,
    fruitByGrade,
    recentAlerts: recentAlerts ?? [],
    recentLogs: recentLogs ?? [],
  });
}
