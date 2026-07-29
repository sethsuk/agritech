/**
 * Creates (or repairs) the dummy accounts.
 *
 * Idempotent by design: auth.users lives outside the public schema, so wiping the
 * public tables leaves the auth accounts behind. When that happens this script finds
 * the existing auth user by email and re-creates its public.users / public.workers
 * rows rather than skipping it.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import ws from "ws";

// supabase-js eagerly constructs a RealtimeClient, which needs a WebSocket impl.
// Node < 22 has none natively. This script never uses realtime — this only satisfies
// that constructor. (The Next.js app doesn't need it; its runtime provides WebSocket.)
(globalThis as { WebSocket?: unknown }).WebSocket ??= ws;

config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ACCOUNTS = [
  { email: "manager@farm.local", password: "manager1234", role: "manager", display_name: "K. Nong" },
  { email: "worker1@farm.local", password: "1111", role: "worker", display_name: "U Aung",  zones: ["A"] },
  { email: "worker2@farm.local", password: "2222", role: "worker", display_name: "Daw Khin", zones: ["A"] },
  { email: "worker3@farm.local", password: "3333", role: "worker", display_name: "U Min",   zones: ["A"] },
];

/** Page through auth users to find one by email (admin API has no direct lookup). */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function run() {
  for (const account of ACCOUNTS) {
    process.stdout.write(`  ${account.email}... `);

    let userId: string;
    let note = "created";

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true, // workers have no email access, skip verification
    });

    if (authErr) {
      if (!authErr.message.includes("already been registered")) {
        console.error(`\n❌  Auth error: ${authErr.message}`);
        process.exit(1);
      }
      const existingId = await findAuthUserIdByEmail(account.email);
      if (!existingId) {
        console.error(`\n❌  ${account.email} is registered but could not be found via listUsers`);
        process.exit(1);
      }
      userId = existingId;
      note = "auth existed, profile re-synced";
    } else {
      userId = authData.user.id;
    }

    // Upsert public.users so a wiped public schema gets repaired on re-run.
    const { error: userErr } = await supabase
      .from("users")
      .upsert({ id: userId, role: account.role, display_name: account.display_name }, { onConflict: "id" });

    if (userErr) {
      console.error(`\n❌  users upsert error: ${userErr.message}`);
      process.exit(1);
    }

    if (account.role === "worker" && account.zones) {
      const { error: workerErr } = await supabase
        .from("workers")
        .upsert({
          worker_id: userId,
          language: "my",
          assigned_zones: account.zones,
          trust_tier: "audit",
        }, { onConflict: "worker_id" });

      if (workerErr) {
        console.error(`\n❌  workers upsert error: ${workerErr.message}`);
        process.exit(1);
      }
    }

    console.log(`✓ (${note})`);
  }

  console.log("\n✅  Accounts ready!\n");
  console.log("  Role     Email                 Password");
  console.log("  ──────── ─────────────────── ──────────");
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(8)} ${a.email.padEnd(21)} ${a.password}`);
  }
}

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
