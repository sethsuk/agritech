import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/manager/overview
 *
 * Aggregated data for the manager dashboard home screen.
 * Requires manager or owner role.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Verify manager/owner role
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "manager" && profile.role !== "owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    { count: openAlertsCount },
    { count: tier1AlertsCount },
    { count: logsToday },
    { count: logsThisWeek },
    { data: recentAlerts },
    { data: recentLogs },
  ] = await Promise.all([
    admin.from("alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
    admin.from("alerts").select("*", { count: "exact", head: true }).eq("status", "open").eq("tier", "tier_1"),
    admin.from("task_logs").select("*", { count: "exact", head: true }).gte("submitted_at", todayStart.toISOString()),
    admin.from("task_logs").select("*", { count: "exact", head: true }).gte("submitted_at", weekAgo.toISOString()),
    admin.from("alerts")
      .select("alert_id, tier, category, subtype, tree_id, worker_id, created_at, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(10),
    admin.from("task_logs")
      .select("log_id, tree_id, task_type, worker_id, submitted_at, validation_status, validation_flags")
      .order("submitted_at", { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({
    openAlertsCount: openAlertsCount ?? 0,
    tier1AlertsCount: tier1AlertsCount ?? 0,
    logsToday: logsToday ?? 0,
    logsThisWeek: logsThisWeek ?? 0,
    recentAlerts: recentAlerts ?? [],
    recentLogs: recentLogs ?? [],
  });
}
