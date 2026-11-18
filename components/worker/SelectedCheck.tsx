/**
 * The ✓ badge on a selected option. Selection must never be signalled by colour or a
 * ring alone — in direct sunlight on a cheap screen, those wash out (design system:
 * "never colour alone").
 */
export function SelectedCheck() {
  return (
    <span aria-hidden className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
      ✓
    </span>
  );
}
