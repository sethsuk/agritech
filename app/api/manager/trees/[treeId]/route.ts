import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/gate";
import { plantedDateProblem, todayBkk } from "@/lib/time";
import type { DbTree } from "@/types/database";

// GET   /api/manager/trees/:treeId — tree + live status + every set (with derived
//       counts) + recent logs (corrections applied, voids removed) + open alerts.
// PATCH /api/manager/trees/:treeId — edit variety / planted date / GPS, or retire.

export async function GET(_request: Request, ctx: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await ctx.params;
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const [tree, summary, sets, recentLogs, openAlerts] = await Promise.all([
    admin.from("trees").select("*").eq("tree_id", treeId).maybeSingle(),
    admin.from("tree_summary").select("*").eq("tree_id", treeId).maybeSingle(),
    admin.from("set_state").select("*").eq("tree_id", treeId).order("bloom_date", { ascending: false }),
    admin.from("effective_task_logs")
      .select("log_id, task_def_id, task_type, worker_name, submitted_at, validation_status, validation_flags")
      .eq("tree_id", treeId)
      .order("submitted_at", { ascending: false })
      .limit(20),
    admin.from("alerts")
      .select("alert_id, tier, category, subtype, created_at")
      .eq("tree_id", treeId)
      .in("status", ["open", "reviewed"])
      .order("created_at", { ascending: false }),
  ]);

  if (!tree.data) return NextResponse.json({ error: "tree_not_found" }, { status: 404 });

  return NextResponse.json({
    tree: tree.data,
    summary: summary.data,
    sets: sets.data ?? [],
    recentLogs: recentLogs.data ?? [],
    openAlerts: openAlerts.data ?? [],
  });
}

const PatchSchema = z.object({
  variety: z.string().trim().min(1).optional(),
  plantedDate: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  long: z.number().min(-180).max(180).optional(),
  status: z.enum(["active", "retired"]).optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await ctx.params;
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { variety, plantedDate, lat, long, status } = parsed.data;
  if ([variety, plantedDate, lat, long, status].every((v) => v === undefined)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (plantedDate !== undefined && plantedDateProblem(plantedDate)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }
  if ((lat === undefined) !== (long === undefined)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const update: Partial<DbTree> = {};
  if (variety !== undefined) update.variety = variety;
  if (plantedDate !== undefined) update.planted_date = plantedDate;
  if (lat !== undefined && long !== undefined) {
    update.lat = lat;
    update.long = long;
  }
  if (status !== undefined) {
    update.status = status;
    update.retired_date = status === "retired" ? todayBkk() : null;
  }

  const { data: tree, error } = await admin
    .from("trees")
    .update(update)
    .eq("tree_id", treeId)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  if (!tree) return NextResponse.json({ error: "tree_not_found" }, { status: 404 });
  return NextResponse.json({ tree });
}
