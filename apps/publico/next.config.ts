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

/**
 * La app del pasajero — **proyecto de Vercel aparte, dentro de este monorepo**.
 *
 * Aparte para aislar el tráfico abierto: es la única superficie de J-Telemetry
 * sin autenticación, y no comparte funciones ni límites con la cara interna.
 * Dentro del monorepo porque el único código que comparte con el resto del
 * producto es la geometría, y ésa ya vive en `@jtel/domain`.
 *
 * **Sin Clerk y sin middleware, a propósito.** Nadie crea una cuenta para saber
 * cuándo pasa el camión.
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@jtel/db", "@jtel/domain"],
};

export default nextConfig;
