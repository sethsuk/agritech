type Item = { issue: string; count: number };

export function IssueFrequencyList({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        ไม่พบปัญหาในสัปดาห์นี้ 🎉
      </div>
    );
  }

  const max = Math.max(...items.map((i) => i.count));

  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.issue}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700">{i.issue}</span>
            <span className="text-xs font-semibold text-slate-600">
              {i.count} ครั้ง
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-red-500"
              style={{ width: `${(i.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
