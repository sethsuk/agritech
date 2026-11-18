import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/gate";

// GET /api/manager/alerts — every active alert plus the most recent closed ones, in one
// response. The page filters by status client-side, so switching tabs needs no request.
// PATCH /api/manager/alerts — resolve, dismiss, or REOPEN an alert.

const CLOSED_LIMIT = 300;

const SELECT = "*, trees(tree_id, zone, side), workers(worker_id, users(display_name))";

export async function GET() {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const [active, closed] = await Promise.all([
    admin.from("alerts").select(SELECT).in("status", ["open", "reviewed"])
      .order("created_at", { ascending: false }),
    admin.from("alerts").select(SELECT).in("status", ["resolved", "dismissed"])
      .order("resolution_resolved_at", { ascending: false, nullsFirst: false })
      .limit(CLOSED_LIMIT),
  ]);
  if (active.error || closed.error) {
    console.error("alerts load failed:", active.error ?? closed.error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ alerts: [...(active.data ?? []), ...(closed.data ?? [])] });
}

const PatchSchema = z.object({
  alertId: z.string().uuid(),
  // "reviewed" is accepted so Undo can restore an alert to exactly its previous status.
  status: z.enum(["open", "reviewed", "resolved", "dismissed"]),
  notes: z.string().trim().max(500).optional(),
});

export async function PATCH(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { alertId, status, notes } = parsed.data;

  // Reopening clears the resolution so the alert reads as genuinely open again.
  const update = status === "open" || status === "reviewed"
    ? {
        status,
        resolution_action_taken: null,
        resolution_resolved_by: null,
        resolution_resolved_at: null,
        resolution_notes: null,
      }
    : {
        status,
        resolution_action_taken: status,
        resolution_resolved_by: userId,
        resolution_resolved_at: new Date().toISOString(),
        resolution_notes: notes || null,
      };

  const { data: updated, error } = await admin
    .from("alerts")
    .update(update)
    .eq("alert_id", alertId)
    .select(SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ alert: updated });
}
