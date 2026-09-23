import { NextResponse } from "next/server";
import { requireWorker } from "@/lib/auth/requireWorker";
import type { DbTaskLog } from "@/types/database";

// GET /api/my-logs — the calling worker's own submitted records (audit log), one
// entry per original submission, annotated with whether it was later corrected or
// voided. Corrections/voids themselves aren't listed here — see
// GET /api/my-logs/:logId for a record's full history.

const LIST_LIMIT = 100;

export async function GET() {
  const gate = await requireWorker();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const { data: roots, error } = await admin
    .from("task_logs")
    .select("*")
    .eq("worker_id", userId)
    .is("correction_of_log_id", null)
    .order("submitted_at", { ascending: false })
    .limit(LIST_LIMIT)
    .returns<DbTaskLog[]>();

  if (error) {
    console.error("my-logs list error:", error);
    return NextResponse.json({ error: "Failed to load logs" }, { status: 500 });
  }

  const rootIds = (roots ?? []).map((r) => r.log_id);
  const { data: amendments } = rootIds.length > 0
    ? await admin
        .from("task_logs")
        .select("correction_of_log_id, correction_type")
        .in("correction_of_log_id", rootIds)
        .returns<Pick<DbTaskLog, "correction_of_log_id" | "correction_type">[]>()
    : { data: [] as Pick<DbTaskLog, "correction_of_log_id" | "correction_type">[] };

  const stateByRoot = new Map<string, { count: number; voided: boolean }>();
  for (const a of amendments ?? []) {
    const rootId = a.correction_of_log_id!;
    const prev = stateByRoot.get(rootId) ?? { count: 0, voided: false };
    stateByRoot.set(rootId, {
      count: prev.count + 1,
      voided: prev.voided || a.correction_type === "void",
    });
  }

  const logs = (roots ?? []).map((log) => {
    const state = stateByRoot.get(log.log_id);
    return {
      ...log,
      amendmentCount: state?.count ?? 0,
      voided: state?.voided ?? false,
    };
  });

  return NextResponse.json({ logs });
}
