import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/trees/:id — lookup active tree by tree_id OR qr_code.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // `id` is interpolated into a PostgREST filter expression below, where commas and
  // dots are syntax. Tree IDs (AL13-7) and QR codes (QR_AL13-7_v1) only ever use this
  // charset, so anything else is rejected before it can reshape the filter.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "ไม่พบต้นไม้รหัสนี้" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: tree, error } = await admin
    .from("trees")
    .select("*")
    .or(`tree_id.eq.${id},qr_code.eq.${id}`)
    .eq("status", "active")
    .maybeSingle();

  if (error || !tree) {
    return NextResponse.json({ error: "ไม่พบต้นไม้รหัสนี้" }, { status: 404 });
  }

  const { data: sets } = await admin
    .from("sets")
    .select("*")
    .eq("tree_id", tree.tree_id)
    .not("status", "in", '("harvested","failed")')
    .order("created_at", { ascending: false });

  return NextResponse.json({ tree, sets: sets ?? [] });
}
