"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang } from "@/lib/i18n/LanguageContext";
import { t } from "@/lib/i18n/t";
import { dict } from "@/lib/i18n/dictionary";

export function LogoutButton() {
  const router = useRouter();
  const { lang } = useLang();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-slate-400 hover:text-slate-600 transition"
    >
      {t(dict.logout, lang)}
    </button>
  );
}
