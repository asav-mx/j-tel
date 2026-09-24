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
 * **`start_url` es `/rutas`, no la raíz** (ASAV, 25-sep-2026). La gente escribe
 * «ontoy.app» y nada más, así que la raíz va a ser de la landing y la app vive en
 * `/rutas`. El `start_url` **se graba al instalar**, así que se mueve AHORA —
 * mientras casi nadie la tiene instalada— y no el día que la landing entre: así
 * ningún ícono ya instalado cambia de destino. Mientras la landing no exista, la
 * raíz sigue enseñando la app. Ver `docs/Ontoy-Direcciones.md`.
 *
 * **El hueco de la identidad ya se llenó** (23-sep-2026). Los archivos tienen
 * nombre fijo en `public/iconos/`, y la identidad entró reemplazándolos sin tocar
 * el código, que era exactamente para lo que se dejaron así. Hoy son Ontoy
 * «¡Ya viene!» sobre Banqueta. Qué archivo va dónde: `docs/Ontoy-Iconos.md`.
 *
 * **Los colores son los de la identidad, y sólo cabe uno.** Un manifiesto tiene
 * un `theme_color`, no dos, así que aquí va el del día —Banqueta `#EDE9E1`—, que
 * es el que Android usa para la pantalla de arranque de la app instalada. El azul
 * noche `#1E2B4D` de la identidad **todavía no entra**: la noche de la app sigue
 * siendo el gris pizarra de `ontoy.css`, y una barra azul marino encima de una app
 * gris se ve como un defecto. Entra con el PR que cambie la piel por los tokens
 * (decisión de ASAV, 23-sep-2026).
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const nombre = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";
  return {
    name: nombre,
    short_name: nombre,
    description: "Dónde viene tu camión, en vivo.",
    start_url: "/rutas",
    display: "standalone",
    orientation: "portrait",
    background_color: "#EDE9E1",
    theme_color: "#EDE9E1",
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
