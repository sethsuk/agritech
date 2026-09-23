import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ManagersList } from "@/components/manager/ManagersList";

// Owner-only page — managers (including this one) can't reach this even by URL.
// Role checks live per-page in this codebase, not in a shared guard (see CLAUDE.md).
export default async function ManagersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "owner") redirect("/dashboard");

  return <ManagersList />;
}
