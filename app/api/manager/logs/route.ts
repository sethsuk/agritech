import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/gate";
import { parseZoneKey } from "@/lib/treeId";
import { rangeStart, RANGE_KEYS, type RangeKey } from "@/lib/time";
import { fetchAll } from "@/lib/supabase/fetchAll";

// GET /api/manager/logs?range=week&zone=AL&task=harvest&worker=<uuid>&status=flagged&page=0
//
// Paginated task logs for the manager Logs page, read from effective_task_logs
// (corrections applied, voided records removed). Logs grow without bound, so unlike the
// other manager lists this one is filtered and paged server-side.
//
// With task=harvest the response also carries fruit-by-grade totals for the filter.

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const p = new URL(request.url).searchParams;
  const range = (RANGE_KEYS as string[]).includes(p.get("range") ?? "") ? (p.get("range") as RangeKey) : "all";
  const zone = parseZoneKey(p.get("zone"));
  const task = p.get("task");
  const worker = p.get("worker");
  const status = p.get("status");
  const page = Math.max(0, Number(p.get("page") ?? 0) || 0);
  const since = rangeStart(range);

  // A fresh builder per use: PostgREST builders are mutable.
  const filtered = <Q extends { gte: Function; eq: Function }>(q: Q): Q => {
    let out = q;
    if (since) out = out.gte("submitted_at", since.toISOString());
    if (zone) out = out.eq("zone", zone.zone).eq("side", zone.side);
    if (task) out = out.eq("task_type", task);
    if (worker) out = out.eq("worker_id", worker);
    if (status === "passed" || status === "flagged") out = out.eq("validation_status", status);
    return out;
  };

  const listQuery = filtered(
    admin.from("effective_task_logs")
      .select("log_id, tree_id, zone, side, task_def_id, task_type, worker_id, worker_name, submitted_at, validation_status, validation_flags, form_data, latest_correction_id", { count: "exact" }),
  )
    .order("submitted_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  const [{ data, count, error }, grades] = await Promise.all([
    listQuery,
    task === "harvest"
      ? fetchAll((from, to) => filtered(admin.from("effective_task_logs").select("form_data"))
          .order("log_id").range(from, to))
      : Promise.resolve({ data: null }),
  ]);
  if (error) {
    console.error("logs load failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  let fruitByGrade: Record<string, number> | null = null;
  if (grades.data) {
    fruitByGrade = {};
    for (const row of grades.data as { form_data: Record<string, unknown> }[]) {
      const g = row.form_data?.grade_counts;
      if (!g || typeof g !== "object") continue;
      for (const [k, v] of Object.entries(g as Record<string, unknown>)) {
        const n = Number(v);
        if (Number.isFinite(n)) fruitByGrade[k] = (fruitByGrade[k] ?? 0) + n;
      }
    }
  }

  return NextResponse.json({
    logs: data ?? [],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    fruitByGrade,
  });
}
