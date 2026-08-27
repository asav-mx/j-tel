import type { MetadataRoute } from "next";

/**
 * El manifiesto que hace instalable la app.
 *
 * El nombre viene de variable de entorno por la misma razón que en el layout:
 * ningún nombre de concesionario dentro del código.
 *
 * **Los íconos son SVG y no PNG.** Pesan cientos de bytes en vez de decenas de
 * KB, escalan a cualquier densidad de pantalla, y en un teléfono con datos
 * contados eso se nota. Son marca provisional: la identidad de la concesión no
 * está diseñada, y cuando lo esté se cambia el archivo sin tocar esto.
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
    ],
  };
}
