"use client";

import { useSignOut } from "@/lib/client/useSignOut";
import { useLang } from "@/lib/i18n/LanguageContext";
import { t } from "@/lib/i18n/t";
import { dict } from "@/lib/i18n/dictionary";

export function LogoutButton() {
  const { lang } = useLang();
  const handleLogout = useSignOut();

  return (
    <button
      onClick={handleLogout}
      className="inline-flex min-h-11 items-center whitespace-nowrap text-sm text-muted transition hover:text-body sm:min-h-0"
    >
      {t(dict.logout, lang)}
    </button>
  );
}
