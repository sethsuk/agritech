import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TreeQrDownloadButton } from "@/components/manager/TreeQrDownloadButton";

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
    if (score >= 0.8) return "text-emerald-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  const healthBg = (score: number) => {
    if (score >= 0.8) return "bg-emerald-50 text-emerald-700";
    if (score >= 0.5) return "bg-amber-50 text-amber-700";
    return "bg-red-50 text-red-700";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header + zone filter */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="mb-3 text-2xl font-bold text-slate-900">ต้นทุเรียน ({trees?.length ?? 0})</h1>
          <div className="flex flex-wrap gap-2">
            {zones.map((z) => (
              <Link
                key={z}
                href={`/trees?zone=${z}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                  zoneFilter === z ? "bg-emerald-600 text-white" : "bg-white text-slate-600 shadow-sm"
                }`}
              >
                {z}
              </Link>
            ))}
            {zoneFilter && (
              <Link href="/trees" className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
                ล้างตัวกรอง
              </Link>
            )}
          </div>
        </div>
        <Link
          href="/trees/new"
          className="flex h-10 flex-shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white active:bg-emerald-700"
        >
          + เพิ่มต้นไม้
        </Link>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 sm:hidden">
        {trees?.map((tree) => (
          <Link
            key={tree.tree_id}
            href={`/trees/${tree.tree_id}`}
            className="block rounded-2xl bg-white p-4 shadow-sm active:bg-slate-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono font-semibold text-slate-900">{tree.tree_id}</p>
                <p className="text-xs text-slate-500">{tree.zone}{tree.side} · {tree.variety}</p>
              </div>
              <div className="flex items-center gap-2">
                {Number(tree.derived_open_alerts) > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    🔔 {tree.derived_open_alerts}
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${healthBg(Number(tree.derived_health_score))}`}>
                  {Math.round(Number(tree.derived_health_score) * 100)}%
                </span>
                <TreeQrDownloadButton treeId={tree.tree_id} qrCode={tree.qr_code} />
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              บันทึกล่าสุด: {tree.derived_days_since_last_log !== null
                ? `${tree.derived_days_since_last_log} วันที่แล้ว`
                : "ยังไม่มี"}
            </p>
          </Link>
        ))}
        {(!trees || trees.length === 0) && (
          <div className="rounded-2xl bg-white p-8 text-center text-slate-400 shadow-sm">ไม่พบต้นทุเรียน</div>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-sm sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">รหัสต้น</th>
              <th className="px-4 py-3 font-medium">โซน</th>
              <th className="px-4 py-3 font-medium">พันธุ์</th>
              <th className="px-4 py-3 font-medium">สุขภาพ</th>
              <th className="px-4 py-3 font-medium">บันทึกล่าสุด</th>
              <th className="px-4 py-3 font-medium">การแจ้งเตือน</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {trees?.map((tree) => (
              <tr key={tree.tree_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/trees/${tree.tree_id}`} className="font-mono font-medium text-slate-800">
                    {tree.tree_id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{tree.zone}{tree.side}</td>
                <td className="px-4 py-3 text-slate-500">{tree.variety}</td>
                <td className={`px-4 py-3 font-semibold ${healthColor(Number(tree.derived_health_score))}`}>
                  {Math.round(Number(tree.derived_health_score) * 100)}%
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {tree.derived_days_since_last_log !== null
                    ? `${tree.derived_days_since_last_log} วันที่แล้ว`
                    : "ยังไม่มี"}
                </td>
                <td className="px-4 py-3">
                  {Number(tree.derived_open_alerts) > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      {tree.derived_open_alerts}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <TreeQrDownloadButton treeId={tree.tree_id} qrCode={tree.qr_code} />
                </td>
              </tr>
            ))}
            {(!trees || trees.length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">ไม่พบต้นทุเรียน</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
