import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/manager/workers — create a new worker account. Requires manager or owner role.
// Workers have no email access, so we mint a pseudo-email `${username}@farm.local` —
// same convention as scripts/seed-users.ts — and hand the manager the plaintext
// credentials to write down for the worker.

const CreateWorkerSchema = z.object({
  displayName: z.string().trim().min(1),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]+$/, "invalid_username"),
  password: z.string().min(4),
  language: z.enum(["my", "th", "en"]),
  zones: z.array(z.string().trim().toUpperCase().min(1)).min(1),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "manager" && profile.role !== "owner")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateWorkerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, username, password, language, zones } = parsed.data;
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
    .insert({ id: userId, role: "worker", display_name: displayName });

  if (userErr) {
    console.error("users insert error:", userErr);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  const { error: workerErr } = await admin
    .from("workers")
    .insert({
      worker_id: userId,
      language,
      assigned_zones: zones,
      trust_tier: "audit",
    });

  if (workerErr) {
    console.error("workers insert error:", workerErr);
    await admin.from("users").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }

  return NextResponse.json({ worker: { id: userId, displayName, email, password, language, zones } });
}
