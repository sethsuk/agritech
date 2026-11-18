"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LanguageContext";
import type { DictKey } from "@/lib/i18n/dictionary";

type Tab = { href: string; labelKey: DictKey; icon: string };

/** One tab list for the desktop top nav and the mobile bottom nav. */
const TABS: Tab[] = [
  { href: "/dashboard", labelKey: "navOverview", icon: "📊" },
  { href: "/alerts",    labelKey: "navAlerts",   icon: "🔔" },
  { href: "/logs",      labelKey: "navLogs",     icon: "📝" },
  { href: "/workers",   labelKey: "navWorkers",  icon: "👷" },
  { href: "/trees",     labelKey: "navTrees",    icon: "🌳" },
];
const OWNER_TAB: Tab = { href: "/managers", labelKey: "navManagers", icon: "🗂️" };

/** Active on the section and its sub-pages (/trees/AL1-1 highlights Trees). */
function useActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function ManagerTopNavLinks({ isOwner }: { isOwner?: boolean }) {
  const { tr } = useT();
  const isActive = useActive();
  return (
    <div className="hidden gap-4 sm:flex">
      {(isOwner ? [...TABS, OWNER_TAB] : TABS).map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={isActive(tab.href) ? "page" : undefined}
          className={`text-sm hover:text-primary-ink ${isActive(tab.href) ? "font-semibold text-primary-ink" : "text-body"}`}
        >
          {tr(tab.labelKey)}
        </Link>
      ))}
    </div>
  );
}

export function ManagerBottomNav({ isOwner }: { isOwner?: boolean }) {
  const { tr } = useT();
  const isActive = useActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="flex">
        {(isOwner ? [...TABS, OWNER_TAB] : TABS).map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold ${
                active ? "text-primary-ink" : "text-muted"
              }`}
            >
              <span aria-hidden className="text-xl leading-none">{tab.icon}</span>
              <span className="leading-none">{tr(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
