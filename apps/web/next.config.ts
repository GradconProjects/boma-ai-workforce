import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    "@boma/core",
    "@boma/db",
    "@boma/bots",
    "@boma/design-engine",
    "@boma/studio",
  ],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default config;
