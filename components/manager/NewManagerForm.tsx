"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage } from "@/lib/i18n/labels";
import { api, errorBody } from "@/lib/client/api";
import { qk } from "@/lib/client/queries";
import { FormField, RequiredLegend } from "@/components/FormField";

interface CreatedManager { displayName: string; username: string; password: string }

export function NewManagerForm() {
  const { lang, tr } = useT();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedManager | null>(null);
  const [copied, setCopied] = useState(false);

  const u = username.trim().toLowerCase();
  const usernameValid = u.length === 0 || /^[a-z0-9._-]+$/.test(u);
  const passwordOk = password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!displayName.trim() || !u || !usernameValid || !passwordOk) {
      toast.error(tr("fixErrorsFirst"));
      return;
    }
    setSubmitting(true);
    try {
      const data = await api<{ manager: CreatedManager }>("/api/owner/managers", {
        method: "POST",
        json: { displayName: displayName.trim(), username: u, password },
      });
      queryClient.invalidateQueries({ queryKey: qk.managers });
      toast.success(tr("managerCreatedToast"));
      setCreated(data.manager);
    } catch (err) {
      toast.error(errorMessage(errorBody(err), lang));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDisplayName(""); setUsername(""); setPassword("");
    setSubmitted(false); setCreated(null); setCopied(false);
  }

  async function copyCredentials() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(tr("passwordCopyText", { u: created.username, p: created.password }));
      setCopied(true);
      toast.success(tr("copiedToast"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(tr("copyFailedToast"));
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-lg border border-line bg-surface p-6 text-center">
          <div aria-hidden className="mb-3 text-5xl">✅</div>
          <h1 className="text-xl font-bold text-ink">{tr("accountCreatedTitle")}</h1>
          <p className="mt-1 text-body">{created.displayName}</p>
          <div className="mt-4 space-y-2 rounded-lg bg-surface-alt p-4 text-left">
            <div>
              <p className="text-xs text-muted">{tr("usernameOrEmailLabel")}</p>
              <p className="font-mono text-sm text-ink">{created.username}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{tr("passwordFieldLabel")}</p>
              <p className="font-mono text-sm text-ink">{created.password}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">{tr("credentialsWarningHint")}</p>
          <button type="button" onClick={copyCredentials} className="mt-6 h-12 w-full rounded-lg bg-primary text-sm font-semibold text-white active:bg-primary-press">
            {copied ? tr("copiedButton") : tr("copyCredentialsButton")}
          </button>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={resetForm} className="h-12 flex-1 rounded-lg border border-line bg-surface-alt text-sm font-semibold text-body active:bg-surface-press">
              {tr("addAnotherManagerButton")}
            </button>
            <Link href="/managers" className="flex h-12 flex-1 items-center justify-center rounded-lg border border-line bg-surface-alt text-sm font-semibold text-body active:bg-surface-press">
              {tr("goToManagersList")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Link href="/managers" className="mb-4 inline-flex min-h-11 items-center text-sm text-muted sm:min-h-0">‹ {tr("back")}</Link>
      <h1 className="mb-6 text-2xl font-bold text-ink">{tr("newManagerTitle")}</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg border border-line bg-surface p-5">
        <RequiredLegend />
        <FormField htmlFor="mgr-name" label={tr("colName")} required error={submitted && !displayName.trim() ? tr("err_bad_request") : undefined}>
          <input id="mgr-name" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none" />
        </FormField>
        <FormField
          htmlFor="mgr-username"
          label={tr("usernameLabel")}
          required
          hint={tr("usernameHint", { u: u || "manager2" })}
          error={!usernameValid || (submitted && !u) ? tr("invalidFormat") : undefined}
        >
          <input id="mgr-username" type="text" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            value={username} onChange={(e) => setUsername(e.target.value)} placeholder="manager2" required
            aria-invalid={!usernameValid || undefined}
            className={`h-12 w-full rounded-lg border px-4 text-base focus:outline-none ${usernameValid ? "border-line focus:border-primary" : "border-2 border-warning"}`} />
        </FormField>
        <FormField
          htmlFor="mgr-password"
          label={tr("passwordFieldLabel")}
          required
          hint={tr("managerPasswordHint")}
          error={(password || submitted) && !passwordOk ? tr("err_weak_password") : undefined}
        >
          <input id="mgr-password" type="text" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none" />
        </FormField>
        <button type="submit" disabled={submitting}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition active:bg-primary-press disabled:bg-surface-press">
          {submitting ? tr("creatingAccount") : tr("createAccountButton")}
        </button>
      </form>
    </div>
  );
}
