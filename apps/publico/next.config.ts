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

/**
 * **La casa de Ontoy es `ontoy.app`** (decisión de ASAV, 23-sep-2026).
 *
 * Hasta hoy la app vivía en `juarezbus.digital`, que es **el nombre de un
 * transportista**. La plataforma no se viste de ninguno: el siguiente
 * concesionario abriría la app de la ciudad y leería la marca de su
 * competencia en la barra de direcciones. Es la misma razón por la que el
 * morado de Juárez Bus no entró a la piel y por la que el nombre de la app
 * sale de una variable y no del código.
 *
 * El dominio viejo **no se apaga: redirige**. Hay letreros impresos, mensajes
 * de WhatsApp y teléfonos con la app instalada apuntando ahí, y un dominio que
 * deja de contestar se lee como «la app se murió».
 */
export const DOMINIOS_VIEJOS = ["juarezbus.digital", "www.juarezbus.digital"];

/** Dónde vive Ontoy. De variable para poder probar el traslado sin desplegar. */
export const SITIO = process.env.NEXT_PUBLIC_SITIO ?? "https://ontoy.app";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@jtel/db", "@jtel/domain"],

  async headers() {
    return RUTAS_QUE_NO_SE_ANUNCIAN.map((source) => ({
      source,
      headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
    }));
  },

  /**
   * El traslado, en el repo y no en un panel.
   *
   * Vercel sabe redirigir un dominio desde sus ajustes, y eso **no aparecería
   * en ningún PR**: es exactamente lo que este repo ya pagó con el límite del
   * firewall, que durante cuatro semanas estuvo escrito en un documento y no
   * existía en ninguna parte. Aquí se lee en el diff y lo cuida una prueba.
   *
   * `permanent` es 308: el navegador lo recuerda y deja de pedirle al dominio
   * viejo. Es lo correcto para una mudanza —no volvemos— y es también lo que
   * hace que un letrero impreso viejo siga sirviendo años.
   *
   * **La ruta se conserva**: un QR pegado en un poste que apunte a
   * `juarezbus.digital/c/zaragoza-centro` tiene que abrir esa misma ruta en
   * `ontoy.app`, no la portada.
   */
  async redirects() {
    return DOMINIOS_VIEJOS.map((host) => ({
      source: "/:ruta*",
      has: [{ type: "host" as const, value: host }],
      destination: `${SITIO}/:ruta*`,
      permanent: true,
    }));
  },
};

export default nextConfig;
