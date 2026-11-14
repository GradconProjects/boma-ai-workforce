import { resolve } from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    "@boma/core",
    "@boma/db",
    "@boma/bots",
    "@boma/design-engine",
    "@boma/studio",
    "@boma/llm",
    "@boma/review",
    "@boma/connectors",
    "@boma/worker",
    "@boma/skills",
  ],
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  // Monorepo: trace from the repo root and ship the runtime config, bot files and migrations
  // that the server reads from disk (they are not imported, so tracing can't find them alone).
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "../../config/**",
      "../../bots/**",
      "../../packages/db/migrations/**",
      "../../skills/**",
    ],
  },
};

export default config;
