import type { VercelConfig } from "@vercel/config/v1";

/**
 * Where the server code (API routes, server components) runs. Each request makes several
 * round trips to Supabase (who is this? what role? then the data), so the functions must
 * sit next to the production database — the default, iad1 (Washington DC), put a Pacific
 * crossing on every one of them. sin1 (Singapore) is next to the prod Supabase
 * (ap-southeast-1) and close to Thailand.
 *
 * One region for every environment: on git deploys Vercel reads this file statically
 * (it is not executed), so a computed value such as a VERCEL_ENV check is dropped and the
 * deployment fails with "`regions` should NOT have fewer than 1 items". Keep these
 * literals. The cost is that previews (dev Supabase, Ohio) are slower — an accepted
 * trade-off; local dev is unaffected. `vercel inspect <url>` shows a deployment's region.
 */
export const config: VercelConfig = {
  regions: ["sin1"],
};
