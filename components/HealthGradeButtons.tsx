"use client";

type Grade = "A" | "B" | "C";

const GRADES: Array<{
  id: Grade;
  label: string;
  description: string;
  selectedClass: string;
  unselectedClass: string;
}> = [
  {
    id: "A",
    label: "A",
    description: "ดี",
    selectedClass: "bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-200",
    unselectedClass: "bg-white text-emerald-700 border-emerald-300",
  },
  {
    id: "B",
    label: "B",
    description: "พอใช้",
    selectedClass: "bg-amber-500 text-white border-amber-500 ring-4 ring-amber-200",
    unselectedClass: "bg-white text-amber-700 border-amber-300",
  },
  {
    id: "C",
    label: "C",
    description: "แย่",
    selectedClass: "bg-red-600 text-white border-red-600 ring-4 ring-red-200",
    unselectedClass: "bg-white text-red-700 border-red-300",
  },
];

export function HealthGradeButtons({
  value,
  onChange,
}: {
  value: Grade | null;
  onChange: (g: Grade) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {GRADES.map((g) => {
        const isSelected = value === g.id;
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onChange(g.id)}
            className={[
              "flex h-20 flex-col items-center justify-center rounded-2xl border-2 font-bold transition active:scale-[0.98]",
              isSelected ? g.selectedClass : g.unselectedClass,
            ].join(" ")}
          >
            <span className="text-3xl leading-none">{g.label}</span>
            <span className="mt-1 text-xs font-medium opacity-80">{g.description}</span>
          </button>
        );
      })}
    </div>
  );
}
