"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/LanguageContext";
import { useTrees, useOverview, type TreeRow } from "@/lib/client/queries";
import { parseZoneKey, zoneKey } from "@/lib/treeId";
import { daysSince } from "@/lib/time";
import { chipClass } from "@/lib/ui/badges";
import { varietyName } from "@/lib/i18n/varieties";
import { TreeHealthBadge } from "@/components/manager/TreeHealthBadge";
import { TreeQrDownloadButton } from "@/components/manager/TreeQrDownloadButton";
import { InfoTip } from "@/components/InfoTip";
import { ErrorState, RefreshBar } from "@/components/QueryState";

const PAGE = 50;

export default function TreesPage() {
  return (
    <Suspense>
      <Trees />
    </Suspense>
  );
}

/**
 * Every tree is loaded once (compact rows + live status) and cached; search, zone,
 * "not checked recently" and retired filters run in memory. Zone chips are built from
 * the data, so a new zone appears as soon as its first tree is added.
 */
function Trees() {
  const { lang, tr } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const trees = useTrees();
  // Only for staleDays, which the dashboard snapshot already carries (cached).
  const overview = useOverview();
  const staleDays = overview.data?.staleDays ?? 3;

  const zone = parseZoneKey(params.get("zone")) ? params.get("zone")! : null;
  const staleOnly = params.get("stale") === "1";
  const showRetired = params.get("retired") === "1";
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);

  const setParam = (key: string, value: string | null) => {
    const qs = new URLSearchParams(params);
    if (value) qs.set(key, value); else qs.delete(key);
    setShown(PAGE);
    router.replace(`/trees?${qs}`, { scroll: false });
  };
  const filtersActive = zone !== null || staleOnly || showRetired || query !== "";

  const zones = useMemo(
    () => [...new Set((trees.data ?? []).filter((t) => t.status === "active").map((t) => zoneKey(t.zone, t.side)))].sort(),
    [trees.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return (trees.data ?? []).filter((t) => {
      if (!showRetired && t.status !== "active") return false;
      if (showRetired && t.status === "active") return false;
      if (zone && zoneKey(t.zone, t.side) !== zone) return false;
      if (q && !t.tree_id.includes(q)) return false;
      if (staleOnly) {
        const d = daysSince(t.last_log_at);
        if (d !== null && d < staleDays) return false;
      }
      return true;
    });
  }, [trees.data, query, zone, staleOnly, showRetired, staleDays]);

  const page = filtered.slice(0, shown);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {tr("navTrees")}{trees.data ? ` (${filtered.length})` : ""}
          </h1>
          <RefreshBar updatedAt={trees.dataUpdatedAt || undefined} fetching={trees.isFetching} onRefresh={() => trees.refetch()} />
        </div>
        <Link
          href="/trees/new"
          className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-press"
        >
          {tr("addTreeButton")}
        </Link>
      </div>

      <div className="mb-4 space-y-2">
        <label htmlFor="tree-search" className="sr-only">{tr("searchTreePlaceholder")}</label>
        <input
          id="tree-search"
          type="search"
          inputMode="text"
          autoCapitalize="characters"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }}
          placeholder={tr("searchTreePlaceholder")}
          className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tr("zoneLabel")}>
          <button type="button" aria-pressed={zone === null} onClick={() => setParam("zone", null)} className={chipClass(zone === null)}>
            {tr("filterZoneAll")}
          </button>
          {zones.map((z) => (
            <button key={z} type="button" aria-pressed={zone === z} onClick={() => setParam("zone", z)} className={chipClass(zone === z)}>
              {z}
            </button>
          ))}
          <span className="inline-flex items-center gap-1">
            <button type="button" aria-pressed={staleOnly} onClick={() => setParam("stale", staleOnly ? null : "1")} className={chipClass(staleOnly)}>
              {tr("statStaleTrees", { n: staleDays })}
            </button>
            <InfoTip text={tr("help_staleTrees", { n: staleDays })} />
          </span>
          <button type="button" aria-pressed={showRetired} onClick={() => setParam("retired", showRetired ? null : "1")} className={chipClass(showRetired)}>
            {tr("retiredBadge")}
          </button>
          {filtersActive && (
            // Same box model as the chips (inline-flex, min-h-11, border) so it lines up
            // with them vertically — it used to be a bare padded link that sat high.
            <button
              type="button"
              onClick={() => { setQuery(""); router.replace("/trees", { scroll: false }); setShown(PAGE); }}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-transparent px-3 text-xs font-semibold text-primary-ink underline-offset-2 hover:underline sm:min-h-8"
            >
              ✕ {tr("clearFilter")}
            </button>
          )}
        </div>
      </div>

      {trees.isError && !trees.data && <ErrorState error={trees.error} onRetry={() => trees.refetch()} />}
      {trees.isPending && (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />)}</div>
      )}

      {trees.data && filtered.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">{tr("noTreesFound")}</div>
      )}

      {/* Mobile: cards */}
      <ul className="space-y-2 sm:hidden">
        {page.map((tree) => (
          <li key={tree.tree_id} className="relative">
            <Link href={`/trees/${tree.tree_id}`} className="block rounded-lg border border-line bg-surface p-4 pr-16 active:bg-surface-alt">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono font-semibold text-ink">{tree.tree_id}</p>
                <TreeHealthBadge openAlerts={tree.open_alerts} hasTier1Alert={tree.has_tier1_alert} />
              </div>
              <p className="text-xs text-muted">{zoneKey(tree.zone, tree.side)} · {varietyName(tree.variety, lang)}</p>
              <p className="mt-1 text-xs text-muted">{tr("lastLogLabel")}: <LastLog tree={tree} /></p>
            </Link>
            <span className="absolute right-3 top-1/2 -translate-y-1/2">
              <TreeQrDownloadButton treeId={tree.tree_id} qrCode={tree.qr_code} />
            </span>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      {page.length > 0 && (
        <div className="hidden overflow-hidden rounded-lg border border-line bg-surface sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-semibold">{tr("colTreeIdLabel")}</th>
                <th className="px-4 py-3 font-semibold">{tr("zoneLabel")}</th>
                <th className="px-4 py-3 font-semibold">{tr("colVariety")}</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1">{tr("colHealth")} <InfoTip text={tr("help_health")} /></span>
                </th>
                <th className="px-4 py-3 font-semibold">{tr("lastLogLabel")}</th>
                <th className="px-4 py-3 font-semibold">{tr("setsTitle")}</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">QR</span></th>
              </tr>
            </thead>
            <tbody>
              {page.map((tree) => (
                <tr key={tree.tree_id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-3">
                    <Link href={`/trees/${tree.tree_id}`} className="font-mono font-semibold text-ink hover:underline">{tree.tree_id}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{zoneKey(tree.zone, tree.side)}</td>
                  <td className="px-4 py-3 text-muted">{varietyName(tree.variety, lang)}</td>
                  <td className="px-4 py-3"><TreeHealthBadge openAlerts={tree.open_alerts} hasTier1Alert={tree.has_tier1_alert} /></td>
                  <td className="px-4 py-3 text-muted"><LastLog tree={tree} /></td>
                  <td className="px-4 py-3 text-muted">{tree.open_sets || "—"}</td>
                  <td className="px-4 py-3"><TreeQrDownloadButton treeId={tree.tree_id} qrCode={tree.qr_code} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > shown && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-xs text-muted">{tr("showingCount", { shown: page.length, total: filtered.length })}</p>
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-5 text-sm font-semibold text-body"
          >
            {tr("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}

function LastLog({ tree }: { tree: TreeRow }) {
  const { tr } = useT();
  const d = daysSince(tree.last_log_at);
  return <>{d === null ? tr("neverLoggedYet") : `${d} ${tr("daysAgoSuffix")}`}</>;
}
