type Props = {
  data: Record<string, { A: number; B: number; C: number }>;
};

export function ZoneHealthBars({ data }: Props) {
  const zones = Object.keys(data).sort();

  if (zones.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        ยังไม่มีข้อมูลการตรวจสัปดาห์นี้
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {zones.map((zone) => {
        const { A, B, C } = data[zone];
        const total = A + B + C;
        const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
        return (
          <div key={zone}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">โซน {zone}</span>
              <span className="text-xs text-slate-500">{total} การตรวจ</span>
            </div>
            <div className="flex h-6 overflow-hidden rounded-full bg-slate-100">
              {A > 0 && (
                <div
                  className="bg-emerald-500"
                  style={{ width: `${pct(A)}%` }}
                  title={`A: ${A}`}
                />
              )}
              {B > 0 && (
                <div
                  className="bg-amber-500"
                  style={{ width: `${pct(B)}%` }}
                  title={`B: ${B}`}
                />
              )}
              {C > 0 && (
                <div
                  className="bg-red-500"
                  style={{ width: `${pct(C)}%` }}
                  title={`C: ${C}`}
                />
              )}
            </div>
            <div className="mt-1 flex gap-3 text-xs text-slate-600">
              <span>A: {A}</span>
              <span>B: {B}</span>
              <span className={C > 0 ? "font-semibold text-red-600" : ""}>C: {C}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
