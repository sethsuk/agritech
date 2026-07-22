"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLang } from "@/lib/i18n/LanguageContext";
import { t } from "@/lib/i18n/t";
import { dict } from "@/lib/i18n/dictionary";

type HomeProps = {
  variant: "home";
};

type BackProps = {
  variant: "back";
  title: string;
  onBack: () => void;
};

type Props = HomeProps | BackProps;

export function WorkerHeader(props: Props) {
  const router = useRouter();
  const { lang } = useLang();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (props.variant === "home") {
    return (
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌳</span>
          <span className="text-base font-bold text-emerald-700">{t(dict.appName, lang)}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button
            onClick={handleLogout}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
            aria-label={t(dict.logout, lang)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
      <button
        onClick={props.onBack}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
        aria-label={t(dict.back, lang)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">{props.title}</h1>
      <LanguageToggle className="flex-shrink-0" />
      <button
        onClick={handleLogout}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
        aria-label={t(dict.logout, lang)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </header>
  );
}
