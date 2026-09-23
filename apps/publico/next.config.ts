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
/**
 * **Las rutas que no se anuncian.** Hoy es una: el lector del camión.
 *
 * `/validador` es una pantalla de operación, y una pantalla de operación no
 * tiene nada que hacer en un buscador. Ya lo decía su `metadata`, que pone la
 * etiqueta dentro del HTML; esto lo dice además **en la respuesta**, que es lo
 * que vale cuando lo que se sirve no es HTML —el manifiesto, una captura, lo
 * que el navegador pida bajo esa ruta— o cuando el rastreador mira la cabecera
 * y no el cuerpo.
 *
 * **No va en `Disallow`, a propósito.** `Disallow` prohíbe rastrear, y quien
 * no rastrea tampoco lee este `noindex`: la dirección puede acabar listada
 * igual si alguien la enlaza. El porqué completo está en `app/robots.ts`.
 */
export const RUTAS_QUE_NO_SE_ANUNCIAN = ["/validador", "/validador/:resto*"];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@jtel/db", "@jtel/domain"],

  async headers() {
    return RUTAS_QUE_NO_SE_ANUNCIAN.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },
};

export default nextConfig;
