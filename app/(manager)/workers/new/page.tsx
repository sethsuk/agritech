"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage } from "@/lib/i18n/labels";
import { api, errorBody } from "@/lib/client/api";
import { qk } from "@/lib/client/queries";
import { LANGUAGES } from "@/lib/client/languages";
import { FormField, RequiredLegend } from "@/components/FormField";

interface CreatedWorker {
  displayName: string;
  username: string;
  password: string;
}

export default function NewWorkerPage() {
  const { lang, tr } = useT();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<"my" | "th" | "en">("my");
  // const [zones, setZones] = useState("A"); // workers currently see all zones — not asked at creation
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedWorker | null>(null);
  const [copied, setCopied] = useState(false);

  const usernameTrimmed = username.trim().toLowerCase();
  const usernameValid = usernameTrimmed.length === 0 || /^[a-z0-9._-]+$/.test(usernameTrimmed);
  // const zoneList = zones.split(",").map((z) => z.trim().toUpperCase()).filter(Boolean); // workers currently see all zones

  const canSubmit =
    displayName.trim().length > 0 &&
    /^[a-z0-9._-]+$/.test(usernameTrimmed) &&
    /^\d{4,6}$/.test(password) &&
    // zoneList.length > 0 &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const data = await api<{ worker: CreatedWorker }>("/api/manager/workers", {
        method: "POST",
        json: { displayName: displayName.trim(), username: usernameTrimmed, password, language },
      });
      queryClient.invalidateQueries({ queryKey: qk.workers });
      toast.success(tr("workerCreatedToast"));
      setCreated(data.worker);
    } catch (err) {
      toast.error(errorMessage(errorBody(err), lang));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDisplayName("");
    setUsername("");
    setPassword("");
    setLanguage("my");
    // setZones("A"); // workers currently see all zones — not asked at creation
    setCreated(null);
    setCopied(false);
  }

  async function copyCredentials() {
    if (!created) return;
    const text = tr("credentialsCopyText", { u: created.username, p: created.password });
    try {
      await navigator.clipboard.writeText(text);
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
        <div className="rounded-lg bg-surface p-6 text-center border border-line">
          <div className="mb-3 text-5xl">✅</div>
          <h1 className="text-xl font-bold text-ink">{tr("accountCreatedTitle")}</h1>
          <p className="mt-1 text-body">{created.displayName}</p>

          <div className="mt-4 space-y-2 rounded-lg bg-surface-alt p-4 text-left">
            <div>
              <p className="text-xs text-muted">{tr("usernameOrEmailLabel")}</p>
              <p className="font-mono text-sm text-ink">{created.username}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{tr("pinLabel")}</p>
              <p className="font-mono text-lg tracking-widest text-ink">{created.password}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            {tr("credentialsWarningHint")}
          </p>

          <button
            onClick={copyCredentials}
            className="mt-6 h-12 w-full rounded-lg bg-primary text-sm font-semibold text-white active:bg-primary-press"
          >
            {copied ? tr("copiedButton") : tr("copyCredentialsButton")}
          </button>

          <div className="mt-3 flex gap-2">
            <button
              onClick={resetForm}
              className="h-12 flex-1 rounded-lg bg-surface-alt text-sm font-semibold text-body active:bg-surface-press"
            >
              {tr("addAnotherWorker")}
            </button>
            <Link
              href="/workers"
              className="flex h-12 flex-1 items-center justify-center rounded-lg bg-surface-alt text-sm font-semibold text-body active:bg-surface-press"
            >
              {tr("goToWorkersList")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/workers" className="inline-flex min-h-11 items-center text-sm text-muted sm:min-h-0">‹ {tr("back")}</Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-ink">{tr("newWorkerTitle")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-surface p-5 border border-line">
        <RequiredLegend />
        <FormField htmlFor="new-worker-name" label={tr("colName")} required>
          <input
            id="new-worker-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
          />
        </FormField>

        <FormField
          htmlFor="new-worker-username"
          label={tr("usernameLabel")}
          required
          hint={tr("usernameHint", { u: usernameTrimmed || "worker4" })}
          error={!usernameValid ? tr("invalidFormat") : undefined}
        >
          <input
            id="new-worker-username"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="worker4"
            required
            className={`h-12 w-full rounded-lg border px-4 text-base focus:outline-none ${
              usernameValid ? "border-line focus:border-primary" : "border-warning"
            }`}
          />
        </FormField>

        <FormField
          htmlFor="new-worker-pin"
          label={tr("pinLabel")}
          required
          hint={tr("minPasswordHint")}
          error={password && !/^\d{4,6}$/.test(password) ? tr("err_weak_pin") : undefined}
        >
          <input
            id="new-worker-pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
            required
            className="h-12 w-full rounded-lg border border-line px-4 font-mono text-lg tracking-widest focus:border-primary focus:outline-none"
          />
        </FormField>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">{tr("languageFieldLabel")}</p>
          <div className="flex gap-2" role="group" aria-label={tr("languageFieldLabel")}>
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                aria-pressed={language === l.value}
                onClick={() => setLanguage(l.value)}
                className={`h-12 flex-1 rounded-lg text-sm font-semibold ${
                  language === l.value ? "bg-primary text-white" : "border border-line bg-surface-alt text-body"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>


        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition active:bg-primary-press disabled:bg-surface-press"
        >
          {submitting ? tr("creatingAccount") : tr("createAccountButton")}
        </button>
      </form>
    </div>
  );
}
