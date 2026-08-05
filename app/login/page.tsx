"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { t } from "@/lib/i18n/t";
import { dict } from "@/lib/i18n/dictionary";

export default function LoginPage() {
  const router = useRouter();
  const { lang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const tr = (key: keyof typeof dict) => t(dict[key], lang);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(tr("loginError"));
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-primary-tint px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <LanguageToggle />
        </div>

        <div className="mb-8 text-center">
          <div className="mb-3 text-6xl">🌳</div>
          <h1 className="text-2xl font-bold text-ink">{tr("loginTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{tr("loginSubtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-surface p-6 border border-line">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-body">
              {tr("emailLabel")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
              className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-body">
              {tr("passwordLabel")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition active:bg-primary-press disabled:bg-surface-press"
          >
            {loading ? tr("loginLoading") : tr("loginButton")}
          </button>
        </form>
      </div>
    </main>
  );
}
