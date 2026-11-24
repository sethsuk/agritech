import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/gate";
import { parseTreeId, qrCodeForTreeId } from "@/lib/treeId";
import { plantedDateProblem } from "@/lib/time";
import { fetchAll } from "@/lib/supabase/fetchAll";
import type { DbTree, TreeSummary } from "@/types/database";

// GET  /api/manager/trees — EVERY tree (active and retired) with its live status from
//      the tree_summary view, in one compact response. The page searches, filters and
//      paginates client-side — previously it silently showed only the first 200 trees.
// POST /api/manager/trees — create a new tree.

export async function GET() {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const [trees, summary] = await Promise.all([
    fetchAll((from, to) => admin.from("trees")
      .select("tree_id, qr_code, zone, side, row_num, position, variety, status")
      .order("zone").order("side").order("row_num").order("position")
      .range(from, to)),
    fetchAll((from, to) => admin.from("tree_summary").select("*").order("tree_id").range(from, to)),
  ]);
  if (trees.error || summary.error) {
    console.error("trees load failed:", trees.error ?? summary.error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const byId = new Map((summary.data as TreeSummary[]).map((s) => [s.tree_id, s]));
  return NextResponse.json({
    trees: (trees.data as Pick<DbTree, "tree_id" | "qr_code" | "zone" | "side" | "row_num" | "position" | "variety" | "status">[])
      .map((t) => {
        const s = byId.get(t.tree_id);
        return {
          ...t,
          last_log_at: s?.last_log_at ?? null,
          open_alerts: s?.open_alerts ?? 0,
          has_tier1_alert: s?.has_tier1_alert ?? false,
          open_sets: s?.open_sets ?? 0,
        };
      }),
  });
}

const CreateTreeSchema = z.object({
  treeId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  long: z.number().min(-180).max(180),
  variety: z.string().trim().min(1),
  plantedDate: z.string(),
});

export async function POST(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = CreateTreeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { treeId: rawTreeId, lat, long, variety, plantedDate } = parsed.data;
  const treeId = rawTreeId.trim().toUpperCase();
  const parsedId = parseTreeId(treeId);
  if (!parsedId) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (plantedDateProblem(plantedDate)) return NextResponse.json({ error: "invalid_date" }, { status: 400 });

  const { data: existing } = await admin.from("trees").select("tree_id").eq("tree_id", treeId).maybeSingle();
  if (existing) return NextResponse.json({ error: "tree_exists" }, { status: 409 });

  const { data: tree, error } = await admin
    .from("trees")
    .insert({
      tree_id: treeId,
      qr_code: qrCodeForTreeId(treeId),
      lat,
      long,
      location_set_at: new Date().toISOString(), // captured on site by the form
      zone: parsedId.zone,
      side: parsedId.side,
      row_num: parsedId.rowNum,
      position: parsedId.position,
      variety,
      planted_date: plantedDate,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !tree) {
    console.error("tree insert error:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json({ tree });
}
