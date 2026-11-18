import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/gate";
import { CORRECTION_ERROR_STATUS } from "@/lib/logCorrections";

// POST /api/my-logs/:logId/void — the worker-facing "delete" for a record they already
// submitted. The void_task_log RPC appends a void row (never deletes), refuses to void a
// bloom whose set already has fruit checks/harvests, dismisses farm-health alerts the
// record raised (fraud alerts are kept), and re-syncs the record's set.

const BodySchema = z.object({
  reason: z.string().trim().min(1),
});

export async function POST(request: Request, ctx: { params: Promise<{ logId: string }> }) {
  const { logId } = await ctx.params;

  const gate = await requireWorker();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }

  const { data: result, error } = await admin.rpc("void_task_log", {
    p_log_id: logId,
    p_worker: userId,
    p_reason: parsed.data.reason,
  });
  if (error || !result) {
    // The one-void-per-record unique index turns a concurrent double void into this.
    if (error?.code === "23505") return NextResponse.json({ error: "already_voided" }, { status: 409 });
    console.error("void_task_log failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (result.error) {
    return NextResponse.json(result, { status: CORRECTION_ERROR_STATUS[result.error] ?? 422 });
  }
  return NextResponse.json({ logId: result.log_id });
}
