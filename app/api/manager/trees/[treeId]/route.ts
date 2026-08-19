import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/requireStaff";
import type { DbTree } from "@/types/database";

// GET /api/manager/trees/:treeId — tree detail + recent logs + open alerts.
// PATCH /api/manager/trees/:treeId — edit variety/planted_date/GPS, or retire/unretire.
// Both require manager or owner role.

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ treeId: string }> },
) {
  const { treeId } = await ctx.params;

  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const [{ data: tree, error: treeErr }, { data: recentLogs }, { data: openAlerts }] = await Promise.all([
    admin.from("trees").select("*").eq("tree_id", treeId).single(),
    admin
      .from("task_logs")
      .select("log_id, task_type, worker_id, submitted_at, validation_status, validation_flags, workers(worker_id, users(display_name))")
      .eq("tree_id", treeId)
      .order("submitted_at", { ascending: false })
      .limit(10),
    admin
      .from("alerts")
      .select("alert_id, tier, category, subtype, created_at")
      .eq("tree_id", treeId)
      .eq("status", "open")
      .order("created_at", { ascending: false }),
  ]);

  if (treeErr || !tree) {
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  }

  return NextResponse.json({
    tree,
    recentLogs: recentLogs ?? [],
    openAlerts: openAlerts ?? [],
  });
}

const PatchSchema = z.object({
  variety: z.string().min(1).optional(),
  plantedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lat: z.number().optional(),
  long: z.number().optional(),
  status: z.enum(["active", "retired"]).optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ treeId: string }> },
) {
  const { treeId } = await ctx.params;

  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { variety, plantedDate, lat, long, status } = parsed.data;
  if (
    variety === undefined && plantedDate === undefined &&
    lat === undefined && long === undefined && status === undefined
  ) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const update: Partial<DbTree> = {};
  if (variety !== undefined) update.variety = variety;
  if (plantedDate !== undefined) update.planted_date = plantedDate;
  if (lat !== undefined) update.lat = lat;
  if (long !== undefined) update.long = long;
  if (status !== undefined) {
    update.status = status;
    update.retired_date = status === "retired" ? new Date().toISOString().slice(0, 10) : null;
  }

  const { data: tree, error } = await admin
    .from("trees")
    .update(update)
    .eq("tree_id", treeId)
    .select("*")
    .single();

  if (error || !tree) {
    return NextResponse.json({ error: "Failed to update tree" }, { status: 500 });
  }

  return NextResponse.json({ tree });
}
