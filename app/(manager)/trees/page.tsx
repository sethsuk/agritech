import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TreeQrDownloadButton } from "@/components/manager/TreeQrDownloadButton";
import { TreeHealthBadge } from "@/components/manager/TreeHealthBadge";
import { T } from "@/components/T";
import { VarietyName } from "@/components/VarietyName";
import { daysSinceLastLog } from "@/lib/derived/treeHealth";

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

  const [{ data: zoneRows }, treesQuery, { data: tier1Rows }] = await Promise.all([
    admin.from("trees").select("zone, side").eq("status", "active"),
    (async () => {
      let query = admin
        .from("trees")
        .select("tree_id, qr_code, zone, side, row_num, position, variety, status, derived_last_updated, derived_open_alerts")
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
    // Which trees have an open tier-1 alert. `derived_open_alerts` is only a count, and
    // the badge escalates on tier — without this the list and the detail page would
    // disagree about the same tree.
    admin.from("alerts").select("tree_id").eq("status", "open").eq("tier", "tier_1"),
  ]);

  const { data: trees } = treesQuery;
  const tier1Trees = new Set((tier1Rows ?? []).map((r) => r.tree_id));

  const zones = Array.from(
    new Set((zoneRows ?? []).map((r) => `${r.zone}${r.side}`)),
  ).sort();

  // One `now` for the whole render so every row's day count is measured from the same instant.
  const now = new Date();

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
                <TreeHealthBadge openAlerts={Number(tree.derived_open_alerts)} hasTier1Alert={tier1Trees.has(tree.tree_id)} />
                <TreeQrDownloadButton treeId={tree.tree_id} qrCode={tree.qr_code} />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              <T k="recentLogsTitle" />: {daysSinceLastLog(tree.derived_last_updated, now) !== null
                ? <>{daysSinceLastLog(tree.derived_last_updated, now)} <T k="daysAgoSuffix" /></>
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
                <td className="px-4 py-3">
                  <TreeHealthBadge openAlerts={Number(tree.derived_open_alerts)} hasTier1Alert={tier1Trees.has(tree.tree_id)} />
                </td>
                <td className="px-4 py-3 text-muted">
                  {daysSinceLastLog(tree.derived_last_updated, now) !== null
                    ? <>{daysSinceLastLog(tree.derived_last_updated, now)} <T k="daysAgoSuffix" /></>
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
