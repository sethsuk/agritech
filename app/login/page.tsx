"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLang, useT } from "@/lib/i18n/LanguageContext";
import { hasStoredLang } from "@/lib/i18n/LanguageContext";
import { toAuthPassword } from "@/lib/auth/pin";
import { LanguageToggle } from "@/components/LanguageToggle";
import { FormField } from "@/components/FormField";
import type { Lang } from "@/lib/i18n/t";

/** Workers have no email: "worker1" signs in as worker1@farm.local. */
const toEmail = (id: string) => {
  const v = id.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@farm.local`;
};

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const { tr } = useT();
  const { setLang } = useLang();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inactive = params.get("reason") === "inactive";

  // A deactivated worker bounced here by the layout still has a session — end it.
  useEffect(() => {
    if (inactive) createClient().auth.signOut();
  }, [inactive]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;

    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: toEmail(username),
      password: toAuthPassword(password), // 4–6 digit PINs are stored prefixed — lib/auth/pin.ts
    });

    if (authError || !data.user) {
      // Inline, next to the form — not a toast that vanishes in 3 seconds.
      setError(authError?.message.toLowerCase().includes("banned") ? tr("err_account_inactive") : tr("loginError"));
      setLoading(false);
      return;
    }

    // First sign-in on this phone: use the language the manager set for this worker,
    // unless they already picked one with the toggle above.
    if (!hasStoredLang()) {
      const { data: worker } = await supabase.from("workers").select("language").eq("worker_id", data.user.id).maybeSingle();
      if (worker?.language) setLang(worker.language as Lang);
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-primary-tint px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-center">
          <LanguageToggle size="worker" />
        </div>

        <div className="mb-8 text-center">
          <div aria-hidden className="mb-3 text-6xl">🌳</div>
          <h1 className="text-2xl font-bold text-ink">{tr("loginTitle")}</h1>
          <p className="mt-1 text-sm text-muted">{tr("loginSubtitle")}</p>
        </div>

        {inactive && (
          <p role="alert" className="mb-4 rounded-lg border border-warning bg-warning-tint p-3 text-sm font-semibold text-warning-ink">
            {tr("err_account_inactive")}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-surface p-6">
          <FormField htmlFor="login-username" label={tr("usernameOrEmailLabel")} hint={tr("usernameOrEmailHint")}>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
            />
          </FormField>

          <FormField htmlFor="login-password" label={tr("passwordLabel")} error={error ?? undefined}>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              aria-invalid={!!error || undefined}
              className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
            />
          </FormField>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition active:bg-primary-press disabled:bg-surface-press"
          >
            {loading ? tr("loginLoading") : tr("loginButton")}
          </button>
        </form>
      </div>
    </main>
  );
}
