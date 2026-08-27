import type { Metadata, Viewport } from "next";
import { Nunito, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
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
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--fuente-texto",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
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
    <html lang="es-MX" className={`${nunito.variable} ${plexMono.variable}`}>
      <body>
        {children}
        <RegistrarServicio />
      </body>
    </html>
  );
}
