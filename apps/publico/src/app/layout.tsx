import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./ontoy.css";
import { RegistrarServicio } from "@/components/registrar-servicio";

/*
 * Nunito e IBM Plex Mono **autoalojadas y subconjuntadas**, no por CDN.
 *
 * El prototipo las trae de fonts.googleapis.com, que en producción cuesta dos
 * viajes de red extra —DNS y TLS a otro dominio— antes de que se vea una letra.
 * `next/font/google` las descarga en el build, recorta a latín y las sirve del
 * mismo origen con `font-display: swap`. En un teléfono con datos contados y red
 * lenta es la misma tipografía por bastante menos.
 */
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
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--fuente-titular",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-texto",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
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
