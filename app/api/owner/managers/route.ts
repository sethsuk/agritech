import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/gate";
import { toAuthPassword } from "@/lib/auth/pin";

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
    return NextResponse.json({ error: "server_error" }, { status: 500 });
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
  // Staff accounts: 8+ characters. (This used to accept 4, which Supabase Auth rejects
  // below 6 — the same bug that made "add worker" return a 500.)
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = CreateManagerSchema.safeParse(body);
  if (!parsed.success) {
    const pwBad = parsed.error.issues.some((i) => i.path[0] === "password");
    return NextResponse.json({ error: pwBad ? "weak_password" : "bad_request" }, { status: 400 });
  }

  const { displayName, username, password } = parsed.data;
  const email = `${username}@farm.local`;

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: toAuthPassword(password),
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    if (authErr?.code === "email_exists" || authErr?.message.includes("already been registered")) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    if (authErr?.code === "weak_password") {
      return NextResponse.json({ error: "weak_password" }, { status: 400 });
    }
    console.error("auth.admin.createUser error:", authErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const userId = authData.user.id;

  const { error: userErr } = await admin
    .from("users")
    .insert({ id: userId, role: "manager", display_name: displayName });

  if (userErr) {
    console.error("users insert error:", userErr);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ manager: { id: userId, displayName, email, password } });
}
