import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/requireStaff";

// GET /api/owner/managers — list manager accounts (with login-active status).
// POST /api/owner/managers — create a new manager account.
// Both require owner role.

export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const { data: managers, error } = await admin
    .from("users")
    .select("id, display_name, created_at")
    .eq("role", "manager")
    .order("created_at");

  if (error) {
    return NextResponse.json({ error: "Failed to load managers" }, { status: 500 });
  }

  // public.users has no `active` column (unlike workers) — ban state lives on the
  // auth user. Fine to fetch per-row at single-digit manager counts.
  const withStatus = await Promise.all(
    (managers ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.id);
      const bannedUntil = data.user?.banned_until;
      const active = !bannedUntil || new Date(bannedUntil).getTime() <= Date.now();
      return { id: m.id, displayName: m.display_name, email: data.user?.email ?? null, active };
    }),
  );

  return NextResponse.json({ managers: withStatus });
}

const CreateManagerSchema = z.object({
  displayName: z.string().trim().min(1),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]+$/, "invalid_username"),
  password: z.string().min(4),
});

export async function POST(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = CreateManagerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, username, password } = parsed.data;
  const email = `${username}@farm.local`;

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    if (authErr?.message.includes("already been registered")) {
      return NextResponse.json(
        { error: "duplicate_username", detail: `ชื่อผู้ใช้ ${username} มีอยู่แล้ว` },
        { status: 409 },
      );
    }
    console.error("auth.admin.createUser error:", authErr);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  const userId = authData.user.id;

  const { error: userErr } = await admin
    .from("users")
    .insert({ id: userId, role: "manager", display_name: displayName });

  if (userErr) {
    console.error("users insert error:", userErr);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  return NextResponse.json({ manager: { id: userId, displayName, email, password } });
}
