type Props = {
  hex: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-10 w-10",
};

export function ColorSwatch({ hex, label, size = "md" }: Props) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block rounded-full border-2 border-white shadow ${SIZES[size]}`}
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </span>
  );
}
