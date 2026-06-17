import type { NextConfig } from "next";

const config: NextConfig = {
  // Prevent webpack from bundling Node.js-only packages used in API routes
  serverExternalPackages: ["ws", "pg"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default config;
