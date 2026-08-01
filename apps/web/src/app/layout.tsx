import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { CLERK_CONFIGURADO } from "@/lib/clerk-estado";
import { SesionActual } from "@/components/sesion-actual";
import { TemaInicial } from "@/components/tema-inicial";
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
  const documento = (
    <html
      lang="es-MX"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
      /* `TemaInicial` escribe data-tema en <html> antes de que React hidrate:
         el servidor no puede saber la preferencia del navegador, así que esa
         diferencia es esperada y no un error. */
      suppressHydrationWarning
    >
      <body>
        {/* Primero que nada, y síncrono: fija el tema antes del primer pintado. */}
        <TemaInicial />
        {children}
        {/* Quién soy — en toda pantalla, mientras auth-rbac no esté terminado. */}
        <SesionActual />
      </body>
    </html>
  );

  /*
   * El proveedor solo se monta si hay llave publicable. `ClerkProvider` sin
   * llave no se degrada: lanza y se lleva todas las pantallas. Envolver
   * condicionalmente es lo que permite que este commit entre a main antes de
   * que las llaves estén aprovisionadas en Vercel — sin llaves, la app queda
   * idéntica a como estaba.
   */
  if (!CLERK_CONFIGURADO) return documento;

  return <ClerkProvider>{documento}</ClerkProvider>;
}
