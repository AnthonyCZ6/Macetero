import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg"],
  // web/ es autosuficiente (su propio lockfile y node_modules); sin esto Turbopack
  // toma la raíz del repo por el package-lock.json de allí.
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
