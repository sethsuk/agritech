import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ManagerBottomNav } from "@/components/manager/ManagerBottomNav";
import { LogoutButton } from "@/components/manager/LogoutButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { T } from "@/components/T";

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "manager" && profile.role !== "owner")) {
    redirect("/scan");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      {/* Top nav — desktop only */}
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-6">
          <span className="text-lg font-bold text-emerald-700">🌳 <T k="loginTitle" /></span>
          <div className="hidden gap-4 sm:flex">
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-emerald-700"><T k="navOverview" /></Link>
            <Link href="/alerts"    className="text-sm text-slate-600 hover:text-emerald-700"><T k="navAlerts" /></Link>
            <Link href="/workers"   className="text-sm text-slate-600 hover:text-emerald-700"><T k="navWorkers" /></Link>
            <Link href="/trees"     className="text-sm text-slate-600 hover:text-emerald-700"><T k="navTrees" /></Link>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <LanguageToggle />
            <span className="text-sm text-slate-500">{profile.display_name}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Extra bottom padding on mobile so content clears the bottom tab bar */}
      <main className="flex-1 pb-20 sm:pb-0">{children}</main>

      <ManagerBottomNav />
    </div>
  );
}
