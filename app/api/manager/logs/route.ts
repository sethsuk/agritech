import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/gate";
import { parseZoneKey } from "@/lib/treeId";
import { bkkDate, rangeStart, RANGE_KEYS, type RangeKey } from "@/lib/time";
import type { ValidationStatus } from "@/types/database";

// GET /api/manager/logs?range=week&zone=AL&task=harvest&worker=<uuid>&status=flagged&page=0
//
// Paginated task logs for the manager Logs page, read from effective_task_logs
// (corrections applied, voided records removed). Logs grow without bound, so unlike the
// other manager lists this one is filtered and paged server-side.
//
// GET /api/manager/logs?…&grades=1 returns only the fruit-by-grade totals for the same
// filters, aggregated in SQL from the daily_fruit rollup — fetched under its own cache key
// so paging through logs doesn't recompute it.

const PAGE_SIZE = 50;

function parseFilters(p: URLSearchParams) {
  const range = (RANGE_KEYS as string[]).includes(p.get("range") ?? "") ? (p.get("range") as RangeKey) : "all";
  const status = p.get("status");
  return {
    since: rangeStart(range),
    zone: parseZoneKey(p.get("zone")),
    task: p.get("task"),
    worker: p.get("worker"),
    status: status === "passed" || status === "flagged" ? (status as ValidationStatus) : null,
    page: Math.max(0, Number(p.get("page") ?? 0) || 0),
  };
}

export async function GET(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const params = new URL(request.url).searchParams;
  const f = parseFilters(params);

  if (params.get("grades") === "1") {
    const { data, error } = await admin.rpc("fruit_by_grade", {
      p_since: f.since ? bkkDate(f.since) : null,
      p_zone: f.zone?.zone ?? null,
      p_side: f.zone?.side ?? null,
      p_worker: f.worker,
      p_status: f.status,
    });
    if (error) {
      console.error("fruit_by_grade failed:", error);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    return NextResponse.json({ fruitByGrade: data ?? {} });
  }

  let q = admin.from("effective_task_logs")
    .select("log_id, tree_id, zone, side, task_def_id, task_type, worker_id, worker_name, submitted_at, validation_status, validation_flags, form_data, latest_correction_id", { count: "exact" });
  if (f.since) q = q.gte("submitted_at", f.since.toISOString());
  if (f.zone) q = q.eq("zone", f.zone.zone).eq("side", f.zone.side);
  if (f.task) q = q.eq("task_type", f.task);
  if (f.worker) q = q.eq("worker_id", f.worker);
  if (f.status) q = q.eq("validation_status", f.status);

  const { data, count, error } = await q
    .order("submitted_at", { ascending: false })
    .range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE - 1);
  if (error) {
    console.error("logs load failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ logs: data ?? [], total: count ?? 0, page: f.page, pageSize: PAGE_SIZE });
}
