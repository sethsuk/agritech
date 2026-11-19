import type { VercelConfig } from "@vercel/config/v1";

/**
 * Where the server code (API routes, server components) runs, per environment. Each
 * request makes several round trips to Supabase (who is this? what role? then the data),
 * so the function must sit next to its database — the default, iad1 (Washington DC),
 * put production a Pacific crossing away from its database on every one of them.
 *
 *   production → sin1 (Singapore): next to the prod Supabase (ap-southeast-1) and Thailand
 *   preview    → cle1 (Cleveland): next to the dev Supabase (us-east-2, Ohio)
 *
 * VERCEL_ENV is set at build time. Preview is the explicit case and everything else
 * falls through to Singapore, so if the variable were ever missing, a preview would land
 * in sin1 and show it — production can't silently drift back to the US.
 * `vercel inspect <url>` shows the region a deployment got.
 */
export const config: VercelConfig = {
  regions: [process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development" ? "cle1" : "sin1"],
};
