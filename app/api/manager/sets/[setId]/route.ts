import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/gate";

// PATCH /api/manager/sets/:setId  { failed: true }  — close an open set by hand as failed
//                                 { failed: false } — reopen a set a manager closed
// Goes through the manager_set_failed RPC (tree lock, same as every set write). The
// derived close reasons (harvested out, last pick…) are never set here — only sync_set does.

const Body = z.object({ failed: z.boolean() });

const STATUS: Record<string, number> = { not_found: 404, set_not_open: 409, ribbon_in_use: 409, bad_request: 400 };

export async function PATCH(request: Request, ctx: { params: Promise<{ setId: string }> }) {
  const { setId } = await ctx.params;
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[0-9a-f-]{36}$/i.test(setId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data, error } = await gate.admin.rpc("manager_set_failed", { p_set: setId, p_failed: parsed.data.failed });
  if (error || !data) {
    console.error("manager_set_failed failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (data.error) return NextResponse.json(data, { status: STATUS[data.error] ?? 422 });
  return NextResponse.json(data);
}
