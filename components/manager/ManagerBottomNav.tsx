"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n/LanguageContext";
import { t } from "@/lib/i18n/t";
import { dict, type DictKey } from "@/lib/i18n/dictionary";

const tabs: { href: string; labelKey: DictKey; icon: string }[] = [
  { href: "/dashboard", labelKey: "navOverview", icon: "📊" },
  { href: "/alerts",    labelKey: "navAlerts",    icon: "🔔" },
  { href: "/workers",   labelKey: "navWorkers",   icon: "👷" },
  { href: "/trees",     labelKey: "navTrees",     icon: "🌳" },
];

export function ManagerBottomNav() {
  const pathname = usePathname();
  const { lang } = useLang();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      <div className="flex">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition ${
                active ? "text-emerald-700" : "text-slate-400"
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="leading-none">{t(dict[tab.labelKey], lang)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
