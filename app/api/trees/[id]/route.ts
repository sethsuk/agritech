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

  const admin = createAdminClient();
  const { data: tree, error } = await admin
    .from("trees")
    .select("*")
    .or(`tree_id.eq.${id},qr_code.eq.${id}`)
    .eq("status", "active")
    .single();

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
