import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/gate";
import { toAuthPassword } from "@/lib/auth/pin";
import { fetchAll } from "@/lib/supabase/fetchAll";
import { reliabilityByWorker, emptyReliability } from "@/lib/derived";

// GET  /api/manager/workers — every worker (active and deactivated) with live
//      reliability stats from the worker_stats view, in one response.
// POST /api/manager/workers — create a worker account. Workers have no email access,
//      so we mint a pseudo-email `${username}@farm.local` (same convention as
//      scripts/seed-users.ts) and hand the manager the credentials to write down.

export async function GET() {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const [{ data: workers, error }, reliability] = await Promise.all([
    admin.from("workers")
      .select("worker_id, language, active, trust_tier, created_at, users(display_name)")
      .order("created_at", { ascending: true }),
    reliabilityByWorker(admin),
  ]);
  if (error) {
    console.error("workers load failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({
    workers: (workers ?? []).map((w) => ({
      ...w,
      reliability: reliability.get(w.worker_id) ?? emptyReliability(),
    })),
  });
}

const CreateWorkerSchema = z.object({
  displayName: z.string().trim().min(1),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]+$/),
  // Worker PINs: 4–6 digits. Supabase's 6-char password minimum is satisfied by the
  // prefix lib/auth/pin.ts adds — a raw 4-digit password was what made this route 500.
  password: z.string().regex(/^\d{4,6}$/),
  language: z.enum(["my", "th", "en"]),
});

export async function POST(request: Request) {
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = CreateWorkerSchema.safeParse(body);
  if (!parsed.success) {
    const pinBad = parsed.error.issues.some((i) => i.path[0] === "password");
    return NextResponse.json({ error: pinBad ? "weak_pin" : "bad_request" }, { status: 400 });
  }

  const { displayName, username, password, language } = parsed.data;
  const email = `${username}@farm.local`;

  // Workers currently see all zones — assign every zone that exists.
  const { data: zoneRows } = await fetchAll((from, to) =>
    admin.from("trees").select("zone").order("tree_id").range(from, to));
  const zones = Array.from(new Set((zoneRows ?? []).map((r) => r.zone))).sort();

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
      return NextResponse.json({ error: "weak_pin" }, { status: 400 });
    }
    console.error("auth.admin.createUser error:", authErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const userId = authData.user.id;
  const rollback = async () => {
    await admin.from("users").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  };

  const { error: userErr } = await admin
    .from("users")
    .insert({ id: userId, role: "worker", display_name: displayName });
  if (userErr) {
    console.error("users insert error:", userErr);
    await rollback();
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const { error: workerErr } = await admin
    .from("workers")
    .insert({ worker_id: userId, language, assigned_zones: zones, trust_tier: "audit" });
  if (workerErr) {
    console.error("workers insert error:", workerErr);
    await rollback();
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // The PIN is echoed back once so the manager can hand it over; it's stored only as a
  // hash inside Supabase Auth and can't be retrieved later (only reset).
  return NextResponse.json({ worker: { id: userId, displayName, username, email, password, language, zones } });
}
