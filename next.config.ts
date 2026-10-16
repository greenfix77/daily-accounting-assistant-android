import type { NextConfig } from "next";

// STATIC_EXPORT=1 → fully static SPA export (out/) for the Capacitor Android build.
// Otherwise → standalone server output for self-hosting (Docker/Railway).
const nextConfig: NextConfig = {
  ...(process.env.STATIC_EXPORT ? { output: "export" as const } : { output: "standalone" as const }),
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
