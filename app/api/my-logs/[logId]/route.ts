import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/auth/requireWorker";
import type { DbTaskLog } from "@/types/database";

// GET /api/my-logs/:logId — one record's full audit trail: the original submission
// plus every correction/void that amends it, oldest first. :logId may be the root
// log or any correction/void row in its chain — both resolve to the same trail.

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ logId: string }> },
) {
  const { logId } = await ctx.params;

  const gate = await requireWorker();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const { data: requested, error: fetchErr } = await admin
    .from("task_logs")
    .select("*")
    .eq("log_id", logId)
    .maybeSingle<DbTaskLog>();

  if (fetchErr || !requested) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }
  if (requested.worker_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rootId = requested.correction_of_log_id ?? requested.log_id;

  const { data: trail, error: trailErr } = await admin
    .from("task_logs")
    .select("*")
    .or(`log_id.eq.${rootId},correction_of_log_id.eq.${rootId}`)
    .order("submitted_at", { ascending: true })
    .returns<DbTaskLog[]>();

  if (trailErr || !trail) {
    return NextResponse.json({ error: "Failed to load log history" }, { status: 500 });
  }

  return NextResponse.json({ rootLogId: rootId, trail });
}
