import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/manager/alerts — paginated open alerts, newest first.
// PATCH /api/manager/alerts — update alert status.

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "open";

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { alertId, status, notes } = parsed.data;
  const admin = createAdminClient();

  const { error } = await admin
    .from("alerts")
    .update({
      status,
      resolution: { resolved_by: user.id, resolved_at: new Date().toISOString(), notes: notes ?? "" },
    })
    .eq("alert_id", alertId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
