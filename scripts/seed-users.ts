import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import ws from "ws";

config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { realtime: { transport: ws } },
);

const ACCOUNTS = [
  { email: "manager@farm.local", password: "manager1234", role: "manager", display_name: "K. Nong" },
  { email: "worker1@farm.local", password: "1111", role: "worker", display_name: "U Aung",  zones: ["North-A", "North-B"] },
  { email: "worker2@farm.local", password: "2222", role: "worker", display_name: "Daw Khin", zones: ["South-A"] },
  { email: "worker3@farm.local", password: "3333", role: "worker", display_name: "U Min",   zones: ["South-B"] },
];

async function run() {
  for (const account of ACCOUNTS) {
    process.stdout.write(`  Creating ${account.email}... `);

    // Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true, // skip email verification
    });

    if (authErr) {
      if (authErr.message.includes("already been registered")) {
        console.log("(already exists, skipped)");
        continue;
      }
      console.error(`\n❌  Auth error: ${authErr.message}`);
      process.exit(1);
    }

    const userId = authData.user.id;

    // Insert into public.users
    const { error: userErr } = await supabase
      .from("users")
      .insert({ id: userId, role: account.role, display_name: account.display_name });

    if (userErr && !userErr.message.includes("duplicate")) {
      console.error(`\n❌  users insert error: ${userErr.message}`);
      process.exit(1);
    }

    // Insert into public.workers for worker accounts
    if (account.role === "worker" && account.zones) {
      const { error: workerErr } = await supabase
        .from("workers")
        .insert({
          worker_id: userId,
          language: "my",
          assigned_zones: account.zones,
          trust_tier: "audit",
        });

      if (workerErr && !workerErr.message.includes("duplicate")) {
        console.error(`\n❌  workers insert error: ${workerErr.message}`);
        process.exit(1);
      }
    }

    console.log("✓");
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
