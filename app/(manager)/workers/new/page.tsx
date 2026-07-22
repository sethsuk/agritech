"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

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
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [language, setLanguage] = useState<"my" | "th" | "en">("my");
  const [zones, setZones] = useState("A");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedWorker | null>(null);
  const [copied, setCopied] = useState(false);

  const usernameTrimmed = username.trim().toLowerCase();
  const usernameValid = usernameTrimmed.length === 0 || /^[a-z0-9._-]+$/.test(usernameTrimmed);
  const zoneList = zones.split(",").map((z) => z.trim().toUpperCase()).filter(Boolean);

  const canSubmit =
    displayName.trim().length > 0 &&
    /^[a-z0-9._-]+$/.test(usernameTrimmed) &&
    password.length >= 4 &&
    zoneList.length > 0 &&
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
          zones: zoneList,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "สร้างบัญชีไม่สำเร็จ");
        return;
      }
      toast.success("สร้างบัญชีคนงานเรียบร้อย ✓");
      setCreated({ displayName: data.worker.displayName, email: data.worker.email, password: data.worker.password });
    } catch {
      toast.error("เกิดข้อผิดพลาด ลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setDisplayName("");
    setUsername("");
    setPassword("");
    setLanguage("my");
    setZones("A");
    setCreated(null);
    setCopied(false);
  }

  async function copyCredentials() {
    if (!created) return;
    const text = `Email: ${created.email}\nPassword: ${created.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("คัดลอกแล้ว");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("คัดลอกไม่สำเร็จ");
    }
  }

  if (created) {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <div className="mb-3 text-5xl">✅</div>
          <h1 className="text-xl font-bold text-slate-900">สร้างบัญชีแล้ว</h1>
          <p className="mt-1 text-slate-700">{created.displayName}</p>

          <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-left">
            <div>
              <p className="text-xs text-slate-400">อีเมลเข้าสู่ระบบ</p>
              <p className="font-mono text-sm text-slate-800">{created.email}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">รหัสผ่าน</p>
              <p className="font-mono text-sm text-slate-800">{created.password}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            จดหรือบอกข้อมูลนี้ให้คนงานโดยตรง — ระบบจะไม่แสดงรหัสผ่านอีก
          </p>

          <button
            onClick={copyCredentials}
            className="mt-6 h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-700"
          >
            {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอกข้อมูลเข้าสู่ระบบ"}
          </button>

          <div className="mt-3 flex gap-2">
            <button
              onClick={resetForm}
              className="h-12 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 active:bg-slate-200"
            >
              เพิ่มคนงานอีกคน
            </button>
            <Link
              href="/workers"
              className="flex h-12 flex-1 items-center justify-center rounded-xl bg-slate-100 text-sm font-medium text-slate-600 active:bg-slate-200"
            >
              ไปที่รายชื่อคนงาน
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/workers" className="text-sm text-slate-400">‹ กลับ</Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">เพิ่มคนงานใหม่</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">ชื่อ</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="U Aung"
            required
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">ชื่อผู้ใช้</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="worker4"
            required
            className={`h-12 w-full rounded-xl border px-4 text-base focus:outline-none ${
              usernameValid ? "border-slate-300 focus:border-emerald-500" : "border-red-400"
            }`}
          />
          <p className="mt-1 text-xs text-slate-400">
            ใช้เข้าสู่ระบบเป็น {usernameTrimmed || "worker4"}@farm.local — ใช้ตัวอักษร a-z, ตัวเลข, . _ - เท่านั้น
          </p>
          {!usernameValid && <p className="mt-1 text-xs text-red-500">รูปแบบไม่ถูกต้อง</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">รหัสผ่าน</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="1111"
            required
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">อย่างน้อย 4 ตัวอักษร</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">ภาษา</label>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLanguage(l.value)}
                className={`h-12 flex-1 rounded-xl text-sm font-medium ${
                  language === l.value ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">โซนที่รับผิดชอบ</label>
          <input
            type="text"
            value={zones}
            onChange={(e) => setZones(e.target.value)}
            placeholder="A"
            required
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base uppercase focus:border-emerald-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">ตัวอักษรโซน คั่นด้วยจุลภาค เช่น A,B</p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white transition active:bg-emerald-700 disabled:bg-slate-300"
        >
          {submitting ? "กำลังสร้าง..." : "สร้างบัญชี"}
        </button>
      </form>
    </div>
  );
}
