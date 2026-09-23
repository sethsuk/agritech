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
  trusted: "bg-primary-tint text-primary-ink",
  standard: "bg-surface-alt text-body",
  audit: "bg-caution-tint text-caution-ink",
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
        <h1 className="text-2xl font-bold text-ink"><T k="navWorkers" /> ({workers?.length ?? 0})</h1>
        <Link
          href="/workers/new"
          className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-press"
        >
          <T k="addWorkerButton" />
        </Link>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 sm:hidden">
        {workers?.map((w) => {
          const name = (w as { users?: { display_name?: string } }).users?.display_name ?? "—";
          return (
            <Link
              key={w.worker_id}
              href={`/workers/${w.worker_id}`}
              className="block rounded-lg bg-surface p-4 border border-line active:bg-surface-alt"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-ink">{name}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierColor[w.trust_tier] ?? ""}`}>
                  {tierLabelKey[w.trust_tier] ? <T k={tierLabelKey[w.trust_tier]} /> : w.trust_tier}
                </span>
              </div>
              {/* Workers currently see all zones — zone display disabled.
              <p className="mt-1 text-sm text-muted">
                <T k="zoneLabel" />: {w.assigned_zones.join(", ") || "—"}
              </p>
              */}
              <div className="mt-2 flex gap-4 text-xs text-muted">
                <span><T k="totalLogsPrefix" /> {w.reliability_logs_total}</span>
                <span><T k="flagRatePrefix" /> {(Number(w.reliability_flag_rate) * 100).toFixed(1)}%</span>
                <span>
                  {w.reliability_avg_completion_seconds > 0
                    ? <><T k="avgPrefix" /> {Math.round(Number(w.reliability_avg_completion_seconds))}s</>
                    : <T k="noDataYet" />}
                </span>
              </div>
            </Link>
          );
        })}
        {(!workers || workers.length === 0) && (
          <div className="rounded-lg bg-surface p-8 text-center text-muted border border-line">
            <T k="noWorkersYet" />
          </div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg bg-surface border border-line sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-semibold"><T k="colName" /></th>
              {/* Workers currently see all zones — zone column disabled. <th className="px-4 py-3 font-semibold"><T k="zoneLabel" /></th> */}
              <th className="px-4 py-3 font-semibold"><T k="colTotalLogs" /></th>
              <th className="px-4 py-3 font-semibold"><T k="colFlagRate" /></th>
              <th className="px-4 py-3 font-semibold"><T k="colAvgTime" /></th>
              <th className="px-4 py-3 font-semibold"><T k="colTrustTier" /></th>
            </tr>
          </thead>
          <tbody>
            {workers?.map((w) => (
              <tr key={w.worker_id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                <td className="px-4 py-3 font-semibold text-ink">
                  <Link href={`/workers/${w.worker_id}`} className="block">
                    {(w as { users?: { display_name?: string } }).users?.display_name ?? "—"}
                  </Link>
                </td>
                {/* <td className="px-4 py-3 text-muted">{w.assigned_zones.join(", ") || "—"}</td> */}
                <td className="px-4 py-3 text-muted">{w.reliability_logs_total}</td>
                <td className="px-4 py-3 text-muted">
                  {(Number(w.reliability_flag_rate) * 100).toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-muted">
                  {w.reliability_avg_completion_seconds > 0
                    ? `${Math.round(Number(w.reliability_avg_completion_seconds))}s`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierColor[w.trust_tier] ?? ""}`}>
                    {tierLabelKey[w.trust_tier] ? <T k={tierLabelKey[w.trust_tier]} /> : w.trust_tier}
                  </span>
                </td>
              </tr>
            ))}
            {(!workers || workers.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted"><T k="noWorkersYet" /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
