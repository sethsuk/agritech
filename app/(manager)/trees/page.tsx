import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TreeQrDownloadButton } from "@/components/manager/TreeQrDownloadButton";
import { T } from "@/components/T";
import { VarietyName } from "@/components/VarietyName";

export default async function TreesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { zone: zoneFilter } = await searchParams;

  const admin = createAdminClient();

  const [{ data: zoneRows }, treesQuery] = await Promise.all([
    admin.from("trees").select("zone, side").eq("status", "active"),
    (async () => {
      let query = admin
        .from("trees")
        .select("tree_id, qr_code, zone, side, row_num, position, variety, status, derived_days_since_last_log, derived_open_alerts, derived_health_score")
        .eq("status", "active")
        .order("zone")
        .order("side")
        .order("row_num")
        .order("position");

      const sideChar = zoneFilter?.slice(1);
      const side = sideChar === "L" || sideChar === "R" ? sideChar : undefined;
      if (zoneFilter && side) query = query.eq("zone", zoneFilter.slice(0, 1)).eq("side", side);
      return query.limit(200);
    })(),
  ]);

  const { data: trees } = treesQuery;

  const zones = Array.from(
    new Set((zoneRows ?? []).map((r) => `${r.zone}${r.side}`)),
  ).sort();

  const healthColor = (score: number) => {
    if (score >= 0.8) return "text-primary-ink";
    if (score >= 0.5) return "text-caution-ink";
    return "text-warning-ink";
  };

  const healthBg = (score: number) => {
    if (score >= 0.8) return "bg-primary-tint text-primary-ink";
    if (score >= 0.5) return "bg-caution-tint text-caution-ink";
    return "bg-warning-tint text-warning-ink";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header + zone filter */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-3 text-2xl font-bold text-ink"><T k="navTrees" /> ({trees?.length ?? 0})</h1>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <Link
                key={z}
                href={`/trees?zone=${z}`}
                className={`inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-semibold sm:min-h-0 sm:py-1.5 ${
                  zoneFilter === z ? "bg-primary text-white" : "bg-surface text-body border border-line"
                }`}
              >
                {z}
              </Link>
            ))}
            {zoneFilter && (
              <Link href="/trees" className="rounded-lg bg-surface-alt px-3 py-1.5 text-xs text-muted">
                <T k="clearFilter" />
              </Link>
            )}
          </div>
        </div>
        <Link
          href="/trees/new"
          className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-press"
        >
          <T k="addTreeButton" />
        </Link>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {trees?.map((tree) => (
          <Link
            key={tree.tree_id}
            href={`/trees/${tree.tree_id}`}
            className="block rounded-lg bg-surface p-4 border border-line active:bg-surface-alt"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-semibold text-ink">{tree.tree_id}</p>
                <p className="text-xs text-muted">{tree.zone}{tree.side} · <VarietyName variety={tree.variety} /></p>
              </div>
              <div className="flex items-center gap-2">
                {Number(tree.derived_open_alerts) > 0 && (
                  <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-ink">
                    🔔 {tree.derived_open_alerts}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${healthBg(Number(tree.derived_health_score))}`}>
                  {Math.round(Number(tree.derived_health_score) * 100)}%
                </span>
                <TreeQrDownloadButton treeId={tree.tree_id} qrCode={tree.qr_code} />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              <T k="recentLogsTitle" />: {tree.derived_days_since_last_log !== null
                ? <>{tree.derived_days_since_last_log} <T k="daysAgoSuffix" /></>
                : <T k="neverLoggedYet" />}
            </p>
          </Link>
        ))}
        {(!trees || trees.length === 0) && (
          <div className="rounded-lg bg-surface p-8 text-center text-muted border border-line"><T k="noTreesFound" /></div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg bg-surface border border-line sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-semibold"><T k="colTreeIdLabel" /></th>
              <th className="px-4 py-3 font-semibold"><T k="zoneLabel" /></th>
              <th className="px-4 py-3 font-semibold"><T k="colVariety" /></th>
              <th className="px-4 py-3 font-semibold"><T k="colHealth" /></th>
              <th className="px-4 py-3 font-semibold"><T k="recentLogsTitle" /></th>
              <th className="px-4 py-3 font-semibold"><T k="navAlerts" /></th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {trees?.map((tree) => (
              <tr key={tree.tree_id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                <td className="px-4 py-3">
                  <Link href={`/trees/${tree.tree_id}`} className="font-mono font-semibold text-ink">
                    {tree.tree_id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{tree.zone}{tree.side}</td>
                <td className="px-4 py-3 text-muted"><VarietyName variety={tree.variety} /></td>
                <td className={`px-4 py-3 font-semibold ${healthColor(Number(tree.derived_health_score))}`}>
                  {Math.round(Number(tree.derived_health_score) * 100)}%
                </td>
                <td className="px-4 py-3 text-muted">
                  {tree.derived_days_since_last_log !== null
                    ? <>{tree.derived_days_since_last_log} <T k="daysAgoSuffix" /></>
                    : <T k="neverLoggedYet" />}
                </td>
                <td className="px-4 py-3">
                  {Number(tree.derived_open_alerts) > 0 ? (
                    <span className="rounded-full bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-ink">
                      {tree.derived_open_alerts}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <TreeQrDownloadButton treeId={tree.tree_id} qrCode={tree.qr_code} />
                </td>
              </tr>
            ))}
            {(!trees || trees.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted"><T k="noTreesFound" /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
