import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/gate";

/**
 * GET /api/manager/overview
 *
 * The whole dashboard in ONE database round trip (the dashboard_snapshot RPC): log
 * counts and fruit-by-grade pre-grouped by every (zone, side) × every Bangkok calendar
 * range, plus open alerts, stale trees, overdue sets and recent logs. The client picks
 * the zone/range locally — switching filters makes no further requests.
 *
 * It replaces a route that re-ran ~9 queries over ~5 sequential round trips on every
 * filter click and summed fruit in JS (silently capped at 1000 rows).
 */

// Days without a log before a tree counts as "not checked recently". Deployment config.
const STALE_TREE_DAYS = Number(process.env.STALE_TREE_DAYS ?? "3");

export async function GET() {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;

  const { data, error } = await gate.admin.rpc("dashboard_snapshot", { p_stale_days: STALE_TREE_DAYS });
  if (error) {
    console.error("dashboard_snapshot failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  return NextResponse.json(data);
}
