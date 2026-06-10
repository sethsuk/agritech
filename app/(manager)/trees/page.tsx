import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TreesPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; status?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { zone, status } = await searchParams;

  const admin = createAdminClient();
  let query = admin
    .from("trees")
    .select("tree_id, zone, row_num, position, variety, status, derived_days_since_last_log, derived_open_alerts, derived_health_score")
    .order("zone")
    .order("row_num")
    .order("position");

  if (zone) query = query.eq("zone", zone);
  if (status) query = query.eq("status", status);
  else query = query.eq("status", "active");

  const { data: trees } = await query.limit(200);

  const healthColor = (score: number) => {
    if (score >= 0.8) return "text-emerald-600";
    if (score >= 0.5) return "text-amber-600";
    return "text-red-600";
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-900">ต้นทุเรียน ({trees?.length ?? 0})</h1>
        <div className="flex gap-2">
          {["North-A", "North-B", "South-A", "South-B"].map((z) => (
            <Link
              key={z}
              href={`/trees?zone=${z}`}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${
                zone === z ? "bg-emerald-600 text-white" : "bg-white text-slate-600 shadow-sm"
              }`}
            >
              {z}
            </Link>
          ))}
          {zone && (
            <Link href="/trees" className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-500">
              ล้าง
            </Link>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">รหัสต้น</th>
              <th className="px-4 py-3 font-medium">โซน</th>
              <th className="px-4 py-3 font-medium">พันธุ์</th>
              <th className="px-4 py-3 font-medium">สุขภาพ</th>
              <th className="px-4 py-3 font-medium">บันทึกล่าสุด</th>
              <th className="px-4 py-3 font-medium">การแจ้งเตือน</th>
            </tr>
          </thead>
          <tbody>
            {trees?.map((tree) => (
              <tr key={tree.tree_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono font-medium text-slate-800">{tree.tree_id}</td>
                <td className="px-4 py-3 text-slate-500">{tree.zone}</td>
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
              </tr>
            ))}
            {(!trees || trees.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">ไม่พบต้นทุเรียน</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
