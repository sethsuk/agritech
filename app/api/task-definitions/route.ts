import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/gate";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/task-definitions — all active task definitions.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("task_definitions")
    .select("*")
    .eq("active", true);

  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  return NextResponse.json(data ?? [], {
    // Task definitions change only on a re-seed: let the browser reuse them for a while.
    headers: { "Cache-Control": "private, max-age=300" },
  });
}
