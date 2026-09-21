import type { MetadataRoute } from "next";

/**
 * El manifiesto que hace instalable la app.
 *
 * El nombre viene de variable de entorno por la misma razón que en el layout:
 * ningún nombre de concesionario dentro del código.
 *
 * **SVG primero, PNG para quien no lee SVG.** El SVG pesa cientos de bytes y
 * escala a cualquier pantalla; los PNG existen porque las tiendas y el empaque
 * de Android los exigen en tamaños fijos (192 y 512, y el de máscara).
 *
 * **Es el hueco de la identidad de Ontoy** (Parte B): los archivos tienen
 * nombre fijo en `public/iconos/`, y la identidad nueva entra reemplazándolos,
 * sin tocar esto. Qué archivo va dónde: `docs/Ontoy-Iconos.md`.
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const nombre = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";
  return {
    name: nombre,
    short_name: nombre,
    description: "Dónde viene tu camión, en vivo.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1418",
    theme_color: "#0f1418",
    lang: "es-MX",
    icons: [
      { src: "/icono.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icono-mascara.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/icono-mascara-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
