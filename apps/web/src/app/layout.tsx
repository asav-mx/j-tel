import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

/*
 * Las tres fuentes del skill j-telemetry-ui, con los pesos que el skill declara
 * para cada papel. Cada una expone una variable CSS; globals.css la recoge en el
 * token --fuente-* correspondiente, que es lo que consumen los componentes.
 * Ningún componente debe nombrar una familia directamente.
 */

/** Lo que se afirma: cifras grandes, títulos, la tesis de la pantalla. */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--fuente-archivo-cargada",
});

/** Lo que se lee de corrido. */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--fuente-sans-cargada",
});

/** Toda medición: horas, unidades, porcentajes, folios, etiquetas de sección. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--fuente-mono-cargada",
});

export const metadata: Metadata = {
  title: "JTEL — Verificación de Transporte",
  description: "Plataforma de cumplimiento de transporte de personal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es-MX"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
