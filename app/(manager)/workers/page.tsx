import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { T } from "@/components/T";
import type { DictKey } from "@/lib/i18n/dictionary";

const tierLabelKey: Record<string, DictKey> = {
  trusted: "tierTrusted",
  standard: "tierStandard",
  audit: "tierAudit",
};
const tierColor: Record<string, string> = {
  trusted: "bg-emerald-100 text-emerald-700",
  standard: "bg-slate-100 text-slate-600",
  audit: "bg-amber-100 text-amber-700",
};

export default async function WorkersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: workers } = await admin
    .from("workers")
    .select("*, users(display_name, role)")
    .eq("active", true)
    .order("created_at");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900"><T k="navWorkers" /> ({workers?.length ?? 0})</h1>
        <Link
          href="/workers/new"
          className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white active:bg-emerald-700"
        >
          <T k="addWorkerButton" />
        </Link>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 sm:hidden">
        {workers?.map((w) => {
          const name = (w as { users?: { display_name?: string } }).users?.display_name ?? "—";
          return (
            <div key={w.worker_id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierColor[w.trust_tier] ?? ""}`}>
                  {tierLabelKey[w.trust_tier] ? <T k={tierLabelKey[w.trust_tier]} /> : w.trust_tier}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                <T k="zoneLabel" />: {w.assigned_zones.join(", ") || "—"}
              </p>
              <div className="mt-2 flex gap-4 text-xs text-slate-400">
                <span><T k="totalLogsPrefix" /> {w.reliability_logs_total}</span>
                <span><T k="flagRatePrefix" /> {(Number(w.reliability_flag_rate) * 100).toFixed(1)}%</span>
                <span>
                  {w.reliability_avg_completion_seconds > 0
                    ? <><T k="avgPrefix" /> {Math.round(Number(w.reliability_avg_completion_seconds))}s</>
                    : <T k="noDataYet" />}
                </span>
              </div>
            </div>
          );
        })}
        {(!workers || workers.length === 0) && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-400 shadow-sm">
            <T k="noWorkersYet" />
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium"><T k="colName" /></th>
              <th className="px-4 py-3 font-medium"><T k="zoneLabel" /></th>
              <th className="px-4 py-3 font-medium"><T k="colTotalLogs" /></th>
              <th className="px-4 py-3 font-medium"><T k="colFlagRate" /></th>
              <th className="px-4 py-3 font-medium"><T k="colAvgTime" /></th>
              <th className="px-4 py-3 font-medium"><T k="colTrustTier" /></th>
            </tr>
          </thead>
          <tbody>
            {workers?.map((w) => (
              <tr key={w.worker_id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {(w as { users?: { display_name?: string } }).users?.display_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{w.assigned_zones.join(", ") || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{w.reliability_logs_total}</td>
                <td className="px-4 py-3 text-slate-500">
                  {(Number(w.reliability_flag_rate) * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {w.reliability_avg_completion_seconds > 0
                    ? `${Math.round(Number(w.reliability_avg_completion_seconds))}s`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierColor[w.trust_tier] ?? ""}`}>
                    {tierLabelKey[w.trust_tier] ? <T k={tierLabelKey[w.trust_tier]} /> : w.trust_tier}
                  </span>
                </td>
              </tr>
            ))}
            {(!workers || workers.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400"><T k="noWorkersYet" /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
