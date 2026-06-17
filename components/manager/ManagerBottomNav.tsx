"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/dashboard", label: "ภาพรวม",       icon: "📊" },
  { href: "/alerts",    label: "การแจ้งเตือน",  icon: "🔔" },
  { href: "/workers",   label: "คนงาน",         icon: "👷" },
  { href: "/trees",     label: "ต้นทุเรียน",    icon: "🌳" },
];

export function ManagerBottomNav() {
  const pathname = usePathname();

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
              <span className="leading-none">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
