import type { Metadata } from "next";
import localFont from "next/font/local";
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
 *
 * ---
 *
 * **Por qué son locales y no `next/font/google`.** `next/font/google` DESCARGA
 * los archivos durante `next build`. Es una llamada a `fonts.gstatic.com` dentro
 * de la compilación, así que una falla de red de Google —o un runner sin salida—
 * **tumba el build entero**, no la tipografía: `Failed to fetch font file` →
 * `Build failed because of webpack errors`. Ya pasó el 12 de agosto de 2026 en
 * el PR #294, con tres reintentos automáticos fallando y un job en rojo por un
 * cambio que solo tocaba documentos.
 *
 * Hoy cuesta un reintento. El día que caiga durante un despliegue urgente cuesta
 * más, y no hay forma de distinguirlo de un defecto propio hasta leer el log.
 * Los archivos viven en el repo: la compilación no sale a internet.
 *
 * Los `.woff2` son el subset **latin** —el mismo que pedía `subsets: ["latin"]`,
 * así que ningún glifo cambia— y se regeneran con `pnpm fuentes:traer`.
 * Ver `src/app/fuentes/LEEME.md`.
 */

/**
 * Lo que se afirma: cifras grandes, títulos, la tesis de la pantalla.
 *
 * Un solo archivo VARIABLE con rango de peso, no dos estáticos: Google sirve
 * Archivo como fuente variable y los archivos de 600 y 700 salieron **byte por
 * byte idénticos**. Declararlos como dos pesos distintos habría pedido al
 * navegador un 700 que el archivo no distingue — y lo habría sintetizado
 * engrosando el 600. El rango es lo que hace que 600 y 700 se vean como antes.
 */
const archivo = localFont({
  src: [{ path: "./fuentes/archivo-variable.woff2", weight: "600 700", style: "normal" }],
  display: "swap",
  variable: "--fuente-archivo-cargada",
});

/** Lo que se lee de corrido. También variable — mismo caso que Archivo. */
const plexSans = localFont({
  src: [{ path: "./fuentes/plex-sans-variable.woff2", weight: "400 500", style: "normal" }],
  display: "swap",
  variable: "--fuente-sans-cargada",
});

/**
 * Toda medición: horas, unidades, porcentajes, folios, etiquetas de sección.
 *
 * Ésta sí viene en archivos estáticos distintos por peso —lo dicen sus hashes—,
 * así que van los dos declarados por separado.
 */
const plexMono = localFont({
  src: [
    { path: "./fuentes/plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fuentes/plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
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
