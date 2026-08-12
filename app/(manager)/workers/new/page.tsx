"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict, type DictKey } from "@/lib/i18n/dictionary";

const LANGUAGES: { value: "my" | "th" | "en"; label: string }[] = [
  { value: "my", label: "မြန်မာ" },
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];

interface CreatedWorker {
  displayName: string;
  email: string;
  password: string;
}

export default function NewWorkerPage() {
  const { lang } = useLang();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<"my" | "th" | "en">("my");
  // const [zones, setZones] = useState("A"); // workers currently see all zones — not asked at creation
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedWorker | null>(null);
  const [copied, setCopied] = useState(false);

  const tr = (key: DictKey) => t(dict[key], lang);

  const usernameTrimmed = username.trim().toLowerCase();
  const usernameValid = usernameTrimmed.length === 0 || /^[a-z0-9._-]+$/.test(usernameTrimmed);
  // const zoneList = zones.split(",").map((z) => z.trim().toUpperCase()).filter(Boolean); // workers currently see all zones

  const canSubmit =
    displayName.trim().length > 0 &&
    /^[a-z0-9._-]+$/.test(usernameTrimmed) &&
    password.length >= 4 &&
    // zoneList.length > 0 &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/manager/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          username: usernameTrimmed,
          password,
          language,
          // zones: zoneList, // workers currently see all zones — assigned server-side
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? tr("createAccountFailedToast"));
        return;
      }
      toast.success(tr("workerCreatedToast"));
      setCreated({ displayName: data.worker.displayName, email: data.worker.email, password: data.worker.password });
    } catch {
      toast.error(tr("scanError"));
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
    const text = `Email: ${created.email}\nPassword: ${created.password}`;
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
              <p className="text-xs text-muted">{tr("loginEmailLabel")}</p>
              <p className="font-mono text-sm text-ink">{created.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{tr("passwordFieldLabel")}</p>
              <p className="font-mono text-sm text-ink">{created.password}</p>
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
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("colName")}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="U Aung"
            required
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("usernameLabel")}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="worker4"
            required
            className={`h-12 w-full rounded-lg border px-4 text-base focus:outline-none ${
              usernameValid ? "border-line focus:border-primary" : "border-warning"
            }`}
          />
          <p className="mt-1 text-xs text-muted">
            {lang === "th"
              ? `ใช้เข้าสู่ระบบเป็น ${usernameTrimmed || "worker4"}@farm.local — ใช้ตัวอักษร a-z, ตัวเลข, . _ - เท่านั้น`
              : lang === "my"
              ? `${usernameTrimmed || "worker4"}@farm.local ဖြင့် လော့ဂ်အင်ဝင်ပါမည် — a-z, ဂဏန်း, . _ - သာ အသုံးပြုပါ`
              : `Logs in as ${usernameTrimmed || "worker4"}@farm.local — letters a-z, digits, . _ - only`}
          </p>
          {!usernameValid && <p className="mt-1 text-xs text-warning-ink">{tr("invalidFormat")}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("passwordFieldLabel")}</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="1111"
            required
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">{tr("minPasswordHint")}</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("languageFieldLabel")}</label>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLanguage(l.value)}
                className={`h-12 flex-1 rounded-lg text-sm font-semibold ${
                  language === l.value ? "bg-primary text-white" : "bg-surface-alt text-body"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Workers currently see all zones — no zone input at creation.
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("zonesResponsibleLabel")}</label>
          <input
            type="text"
            value={zones}
            onChange={(e) => setZones(e.target.value)}
            placeholder="A"
            required
            className="h-12 w-full rounded-lg border border-line px-4 text-base uppercase focus:border-primary focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">{tr("zonesHint")}</p>
        </div>
        */}

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
