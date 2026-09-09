import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireStaff";

// PATCH /api/owner/managers/:userId — deactivate/reactivate a manager account. Owner only.

const PatchSchema = z.object({
  active: z.boolean(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ userId: string }> },
) {
  const { userId } = await ctx.params;

  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Only ever touch manager accounts through this endpoint — never an owner (including
  // the caller themselves), even if someone guesses another owner's id.
  const { data: target } = await admin.from("users").select("role").eq("id", userId).single();
  if (!target || target.role !== "manager") {
    return NextResponse.json({ error: "Manager not found" }, { status: 404 });
  }

  const { active } = parsed.data;
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  });
  if (banErr) {
    return NextResponse.json({ error: "Failed to update manager" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
