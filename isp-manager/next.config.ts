import type { NextConfig } from "next";

// Internal, fully per-user dynamic app: every page reads the session,
// so Cache Components / partial prefetching are intentionally off.
const nextConfig: NextConfig = {
  // Excel import and backup restore upload files up to ~4 MB.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
