import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth/gate";
import { ManagerBottomNav, ManagerTopNavLinks } from "@/components/manager/ManagerBottomNav";
import { LogoutButton } from "@/components/manager/LogoutButton";
import { LanguageToggle } from "@/components/LanguageToggle";
import { T } from "@/components/T";

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  const me = await getSession();
  if (!me) redirect("/login");
  if (!isStaff(me.role)) redirect("/scan");

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
          <ManagerTopNavLinks isOwner={me.role === "owner"} />
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <LanguageToggle />
            {/* Name is the least load-bearing item here — drop it on mobile so the
                toggle and logout stay on one line. */}
            <span className="hidden whitespace-nowrap text-sm text-muted sm:inline">
              {me.displayName}
            </span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Extra bottom padding on mobile so content clears the bottom tab bar */}
      {/* Bottom padding clears the fixed mobile tab bar plus the iPhone home-indicator inset. */}
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">{children}</main>

      <ManagerBottomNav isOwner={me.role === "owner"} />
    </div>
  );
}
