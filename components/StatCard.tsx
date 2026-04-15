type Props = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "warning" | "danger";
};

const TONES: Record<NonNullable<Props["tone"]>, string> = {
  default: "border-slate-200 bg-white",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-red-200 bg-red-50",
};

export function StatCard({ label, value, hint, tone = "default" }: Props) {
  return (
    <div className={`rounded-2xl border-2 p-4 ${TONES[tone]}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
