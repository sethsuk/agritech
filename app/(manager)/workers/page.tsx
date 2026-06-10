import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  const tierLabel: Record<string, string> = { trusted: "เชื่อถือ", standard: "ปกติ", audit: "ตรวจสอบ" };
  const tierColor: Record<string, string> = {
    trusted: "bg-emerald-100 text-emerald-700",
    standard: "bg-slate-100 text-slate-600",
    audit: "bg-amber-100 text-amber-700",
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">คนงาน ({workers?.length ?? 0})</h1>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
              <th className="px-4 py-3 font-medium">ชื่อ</th>
              <th className="px-4 py-3 font-medium">โซน</th>
              <th className="px-4 py-3 font-medium">บันทึกทั้งหมด</th>
              <th className="px-4 py-3 font-medium">อัตราแฟลก</th>
              <th className="px-4 py-3 font-medium">เวลาเฉลี่ย</th>
              <th className="px-4 py-3 font-medium">ระดับความน่าเชื่อถือ</th>
            </tr>
          </thead>
          <tbody>
            {workers?.map((w) => (
              <tr key={w.worker_id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">
                  {(w as { users?: { display_name?: string } }).users?.display_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {w.assigned_zones.join(", ") || "—"}
                </td>
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
                    {tierLabel[w.trust_tier] ?? w.trust_tier}
                  </span>
                </td>
              </tr>
            ))}
            {(!workers || workers.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  ยังไม่มีคนงาน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
