import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/gate";

// GET /api/manager/logs/:logId — one record as it stands now (effective_task_logs) plus
// its full audit trail (original + corrections + void) and any alerts it raised. This
// is the evidence a manager needs before resolving or dismissing an alert.
export async function GET(_request: Request, ctx: { params: Promise<{ logId: string }> }) {
  const { logId } = await ctx.params;
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  if (!/^[0-9a-f-]{36}$/i.test(logId)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: row } = await admin.from("task_logs").select("log_id, correction_of_log_id").eq("log_id", logId).maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const rootId = row.correction_of_log_id ?? row.log_id;

  const [effective, trail, alerts, root] = await Promise.all([
    admin.from("effective_task_logs").select("*").eq("log_id", rootId).maybeSingle(),
    admin.from("task_logs")
      .select("log_id, correction_type, correction_reason, submitted_at, form_data, validation_status, validation_flags")
      .or(`log_id.eq.${rootId},correction_of_log_id.eq.${rootId}`)
      .order("submitted_at", { ascending: true }),
    admin.from("alerts").select("alert_id, tier, subtype, status, created_at").eq("triggered_by_log_id", rootId),
    // task_logs.worker_id references workers, and workers.worker_id references users, so
    // the name is two hops away. (`users:worker_id(…)` looked up display_name on workers,
    // failed, and — unchecked — left `root` null, so every log page showed an error.)
    admin.from("task_logs")
      .select("log_id, tree_id, task_def_id, worker_id, submitted_at, gps_delta_meters, photo_url, validation_flags, form_data, workers(users(display_name))")
      .eq("log_id", rootId)
      .maybeSingle(),
  ]);

  const failed = [effective, trail, alerts, root].find((r) => r.error);
  if (failed) {
    console.error("log detail failed:", failed.error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const { workers, ...rootRow } = root.data as unknown as Record<string, unknown> & {
    workers: { users: { display_name: string } | null } | null;
  };
  return NextResponse.json({
    rootId,
    // Null when the record was voided — the root row is still returned for the trail.
    effective: effective.data,
    root: { ...rootRow, worker_name: workers?.users?.display_name ?? null },
    trail: trail.data ?? [],
    alerts: alerts.data ?? [],
  });
}
