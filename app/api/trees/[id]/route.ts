import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/gate";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DbTree, SetState } from "@/types/database";

// GET /api/trees/:id — look up an active tree by tree_id OR qr_code, plus its OPEN sets
// with live counts (remaining fruit etc. from the set_state view). The worker's harvest
// and fruit-count forms pick from these sets, and bloom greys out ribbons in use.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // `id` is interpolated into a PostgREST filter expression below, where commas and
  // dots are syntax. Tree IDs (AL13-7) and QR codes (QR_AL13-7_v1) only ever use this
  // charset, so anything else is rejected before it can reshape the filter.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "tree_not_found" }, { status: 404 });
  }

  const admin = createAdminClient();
  // Tree IDs are stored upper-case; QR payloads are matched exactly (they contain "_v1").
  const { data: tree } = await admin
    .from("trees")
    .select("*")
    .or(`tree_id.eq.${id.toUpperCase()},qr_code.eq.${id}`)
    .eq("status", "active")
    .maybeSingle<DbTree>();
  if (!tree) return NextResponse.json({ error: "tree_not_found" }, { status: 404 });

  const { data: sets } = await admin
    .from("set_state")
    .select("*")
    .eq("tree_id", tree.tree_id)
    .is("closed_at", null)
    .order("bloom_date", { ascending: true })
    .returns<SetState[]>();

  return NextResponse.json({ tree, sets: sets ?? [] });
}
