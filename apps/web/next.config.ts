import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = new URL(".", import.meta.url);
const workspaceRoot = resolve(fileURLToPath(configDirectory), "../..");
loadEnvConfig(workspaceRoot);

const config: NextConfig = {
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" as const } : {}),
  poweredByHeader: false,
  outputFileTracingRoot: workspaceRoot,
  async rewrites() {
    const origin = process.env.API_INTERNAL_ORIGIN ?? (process.env.API_INTERNAL_HOST
      ? `http://${process.env.API_INTERNAL_HOST}:${process.env.API_INTERNAL_PORT ?? "4000"}` : undefined);
    return origin ? [{ source: "/api/:path*", destination: `${origin}/api/:path*` }] : [];
  },
};

export default config;
