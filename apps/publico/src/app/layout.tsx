import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./ontoy.css";
import { RegistrarServicio } from "@/components/registrar-servicio";

/*
 * La letra de Ontoy: Archivo para lo que identifica, IBM Plex Sans para lo que
 * se lee de corrido, IBM Plex Mono para toda medición. Es la cara de Ontoy, no
 * la de la plataforma (decisión de ASAV, 21-sep).
 *
 * Autoalojadas y subconjuntadas, no por CDN: el prototipo las trae de
 * fonts.googleapis.com, que en producción cuesta dos viajes de red extra —DNS y
 * TLS a otro dominio— antes de que se vea una letra, y de paso le cuenta a un
 * tercero que alguien abrió la app. En un teléfono con datos contados es la
 * misma tipografía por bastante menos, y sin el tercero.
 *
 * ---
 *
 * **Por qué son locales y no `next/font/google`** (22-sep-2026).
 * `next/font/google` DESCARGA los archivos durante `next build`: si Google no
 * contesta, no falla la tipografía, **falla la compilación** —
 * `An error occurred in next/font · TypeError: Cannot read properties of null`.
 * Pasó en CI en #493 y #498, en PRs que no tocaban esta app, y sólo se
 * distinguía de un defecto propio leyendo el log. La web ya había pagado esa
 * lección el 12-ago (#294). Los archivos viven en `./fuentes/`: la compilación
 * no sale a internet, y la valla `scripts/verificar-fuentes-locales.mjs` tumba
 * CI si alguna app vuelve a importar `next/font/google`.
 *
 * Son **byte por byte** los que `next/font/google` servía — ni un glifo ni un
 * byte más para el pasajero. Se regeneran con `pnpm --filter @jtel/publico fuentes:traer`; ver
 * `src/app/fuentes/LEEME.md`.
 *
 * Archivo e IBM Plex Sans son VARIABLES —un archivo para todos los pesos—, así
 * que se declara el RANGO que se usa. Declarar pesos sueltos sobre el mismo
 * archivo haría que el navegador sintetizara el grueso engrosando el delgado.
 */
const archivo = localFont({
  src: [{ path: "./fuentes/archivo-variable.woff2", weight: "600 700", style: "normal" }],
  variable: "--fuente-titular",
  display: "swap",
});

const plexSans = localFont({
  src: [{ path: "./fuentes/plex-sans-variable.woff2", weight: "400 600", style: "normal" }],
  variable: "--fuente-texto",
  display: "swap",
});

/** Ésta sí viene en un archivo por peso. */
const plexMono = localFont({
  src: [
    { path: "./fuentes/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fuentes/plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--fuente-mono",
  display: "swap",
});

/**
 * El nombre sale de variable de entorno y no del código: esta app sirve a
 * cualquier concesionario invitado, y hornear «Juárez Bus» aquí convertiría el
 * alta del siguiente en un despliegue.
 */
const NOMBRE = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";

export const metadata: Metadata = {
  title: NOMBRE,
  description: "Dónde viene tu camión, en vivo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: NOMBRE, statusBarStyle: "default" },
  // iOS no lee el manifiesto para el ícono de inicio: quiere este PNG (hueco de la identidad, `docs/Ontoy-Iconos.md`).
  icons: { icon: "/icono.svg", apple: "/iconos/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Sin `maximumScale`: bloquear el zoom en una app que se usa en la calle deja
  // fuera a quien no ve de cerca. La accesibilidad gana al pixel perfect.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141225" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <RegistrarServicio />
      </body>
    </html>
  );
}
