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
      className="inline-flex min-h-11 items-center whitespace-nowrap text-sm text-muted transition hover:text-body sm:min-h-0"
    >
      {t(dict.logout, lang)}
    </button>
  );
}
