import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rootEnv = path.join(__dirname, "../../.env");
if (existsSync(rootEnv)) {
  try {
    process.loadEnvFile(rootEnv);
  } catch {
    /* ignore */
  }
}

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: [
    "@jtel/db",
    "@jtel/domain",
    "@jtel/auth-rbac",
    "@jtel/reports",
    "@jtel/verification",
    "@jtel/services",
    "@jtel/gps-core",
    "@jtel/gps-umbrella",
  ],
};

export default nextConfig;
