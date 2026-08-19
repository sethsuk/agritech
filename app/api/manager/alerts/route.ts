import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/requireStaff";
import type { AlertStatus } from "@/types/database";

// GET /api/manager/alerts — paginated alerts by status, newest first.
// PATCH /api/manager/alerts — update alert status.
// Both require manager or owner role.

const ALERT_STATUSES: readonly AlertStatus[] = ["open", "reviewed", "resolved", "dismissed"];

export async function GET(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const status: AlertStatus = ALERT_STATUSES.includes(statusParam as AlertStatus)
    ? (statusParam as AlertStatus)
    : "open";

  const { data, error } = await admin
    .from("alerts")
    .select("*, trees(tree_id,zone,variety), workers(worker_id,users(display_name))")
    .eq("status", status)
    .order("tier", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

const PatchSchema = z.object({
  alertId: z.string().uuid(),
  status: z.enum(["reviewed", "resolved", "dismissed"]),
  notes: z.string().optional(),
});

export async function PATCH(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { alertId, status, notes } = parsed.data;

  const { data: updated, error } = await admin
    .from("alerts")
    .update({
      status,
      resolution_action_taken: status,
      resolution_resolved_by: userId,
      resolution_resolved_at: new Date().toISOString(),
      resolution_notes: notes ?? null,
    })
    .eq("alert_id", alertId)
    .select("alert_id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Previously returned ok:true even for an alert_id that matched nothing.
  if (!updated) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
