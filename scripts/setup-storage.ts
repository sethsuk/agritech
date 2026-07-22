import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function run() {
  const { data: buckets, error: listErr } = await sb.storage.listBuckets();
  if (listErr) { console.error("Cannot list buckets:", listErr.message); process.exit(1); }

  const exists = buckets?.some((b) => b.name === "task-photos");

  if (exists) {
    console.log("✓  task-photos bucket already exists");
  } else {
    const { error } = await sb.storage.createBucket("task-photos", { public: true });
    if (error) { console.error("Failed to create bucket:", error.message); process.exit(1); }
    console.log("✓  task-photos bucket created (public)");
  }

  console.log("Buckets:", buckets?.map((b) => `${b.name} (${b.public ? "public" : "private"})`).join(", "));
}

run().catch(console.error);
