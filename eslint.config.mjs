import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// ESLint 9 flat config. Next 15's shareable configs are still in the legacy format, so
// they're loaded through FlatCompat. (`next lint` is deprecated and, with no config,
// stopped at an interactive setup prompt — so lint had never actually run.)
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "test-results/**", "playwright-report/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
