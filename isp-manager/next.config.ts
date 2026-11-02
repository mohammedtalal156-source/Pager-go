import type { NextConfig } from "next";

// Internal, fully per-user dynamic app: every page reads the session,
// so Cache Components / partial prefetching are intentionally off.
const nextConfig: NextConfig = {
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
