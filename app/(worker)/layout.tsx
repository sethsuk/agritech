import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function WorkerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Ensure role is worker (managers who navigate here should go to /dashboard)
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "manager" || profile?.role === "owner") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-dvh bg-slate-50 font-[family-name:var(--font-thai)]">
      {children}
    </div>
  );
}
