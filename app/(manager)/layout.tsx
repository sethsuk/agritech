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
    <div className="flex min-h-dvh flex-col bg-surface-alt">
      {/* Top nav — desktop only */}
      <nav className="sticky top-0 z-10 border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center gap-6">
          {/* Wordmark is hidden on mobile — the logo alone identifies the app, and the
              header has to fit the language toggle, display name and logout button. */}
          <span className="flex flex-shrink-0 items-center gap-2 text-lg font-bold text-primary-ink">
            <span>🌳</span>
            <span className="hidden sm:inline"><T k="loginTitle" /></span>
          </span>
          <div className="hidden gap-4 sm:flex">
            <Link href="/dashboard" className="text-sm text-body hover:text-primary-ink"><T k="navOverview" /></Link>
            <Link href="/alerts"    className="text-sm text-body hover:text-primary-ink"><T k="navAlerts" /></Link>
            <Link href="/workers"   className="text-sm text-body hover:text-primary-ink"><T k="navWorkers" /></Link>
            <Link href="/trees"     className="text-sm text-body hover:text-primary-ink"><T k="navTrees" /></Link>
          </div>
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <LanguageToggle />
            {/* Name is the least load-bearing item here — drop it on mobile so the
                toggle and logout stay on one line. */}
            <span className="hidden whitespace-nowrap text-sm text-muted sm:inline">
              {profile.display_name}
            </span>
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
