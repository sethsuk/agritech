import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";
import ws from "ws";

// Same eager-RealtimeClient WebSocket requirement as scripts/*.ts — see CLAUDE.md.
(globalThis as { WebSocket?: unknown }).WebSocket ??= ws;

config({ path: resolve(process.cwd(), ".env.local") });

// Deletes any accounts the e2e suite created (owner.spec.ts, worker-management.spec.ts
// use the `e2e_` username prefix). Deleting the auth.users row cascades to
// public.users/public.workers, so nothing else needs cleaning up.
export default async function globalTeardown() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("global-teardown: listUsers failed:", error.message);
      return;
    }
    const toDelete = data.users.filter((u) => u.email?.startsWith("e2e_"));
    for (const user of toDelete) {
      await admin.auth.admin.deleteUser(user.id);
      console.log(`  e2e cleanup: deleted ${user.email}`);
    }
    if (data.users.length < 200) break;
  }
}
