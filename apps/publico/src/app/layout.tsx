import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./tokens-ontoy.css";
import "./ontoy.css";
import { RegistrarServicio } from "@/components/registrar-servicio";

/*
 * La letra de Ontoy: **Bricolage Grotesque** para lo que identifica —títulos,
 * placas y cifras— e **Instrument Sans** para todo lo que se lee. Son las de
 * `tokens/typography.css` del skill `ontoy-design`, que es con lo que está
 * dibujada la app aprobada.
 *
 * **Reemplazan a Archivo + IBM Plex Sans + IBM Plex Mono**, que era la letra
 * del prototipo del 21-sep. Los tres archivos se fueron del repo: la app era su
 * única lectora y `apps/web` tiene los suyos aparte.
 *
 * **Y con ellos se fue la monoespaciada, que no tiene reemplazo a propósito.**
 * El sistema de Ontoy no tiene mono. Lo que la mono de verdad daba —que las
 * cifras midan lo mismo y no bailen al cambiar— no era la familia sino
 * `tabular-nums`, y eso Instrument Sans lo da igual. La clase pasó de `.mono` a
 * `.cifra` por lo mismo: un nombre que dice «monoespaciada» sobre una letra que
 * no lo es se cuela de vuelta al siguiente cambio.
 *
 * ## Autoalojadas, y no es preferencia
 *
 * `next/font/google` **descarga los archivos durante `next build`**: si Google
 * no contesta, no falla la tipografía — **falla la compilación**
 * (`An error occurred in next/font · TypeError: Cannot read properties of
 * null`). Pasó en CI en #493 y #498, en PRs que no tocaban esta app, y sólo se
 * distinguía de un defecto propio leyendo el log. La web ya había pagado esa
 * lección el 12-ago (#294). Los archivos viven en `./fuentes/` y la valla
 * `scripts/verificar-fuentes-locales.mjs` tumba CI si alguna app vuelve a
 * importarlo. Se regeneran con `pnpm --filter @jtel/publico fuentes:traer`.
 *
 * ## Las dos son VARIABLES
 *
 * Un archivo para todos los pesos, así que se declara el **rango**. Declarar
 * pesos sueltos sobre el mismo archivo haría que el navegador sintetizara el
 * grueso engrosando el delgado — y el titular de Ontoy vive del grueso.
 *
 * Bricolage trae además el eje `opsz`, y **no se fija**: es lo que hace que un
 * título de 28 px y una placa de 14 estén dibujados cada uno para su tamaño.
 * Lo que cuesta está medido en `src/app/fuentes/LEEME.md`.
 *
 * **La landing declara estas dos mismas familias por su lado**
 * (`components/landing/letra.ts`), y el navegador no baja nada dos veces: Next
 * sirve el mismo archivo y son dos páginas distintas. Juntarlas es una limpieza
 * de una línea del lado de la landing, que es otro frente.
 */
const bricolage = localFont({
  src: [{ path: "./fuentes/bricolage-variable.woff2", weight: "600 800", style: "normal" }],
  variable: "--fuente-titular",
  display: "swap",
});

const instrumentSans = localFont({
  src: [{ path: "./fuentes/instrument-sans-variable.woff2", weight: "400 700", style: "normal" }],
  variable: "--fuente-texto",
  display: "swap",
});

/**
 * El nombre sale de variable de entorno y no del código: esta app sirve a
 * cualquier concesionario invitado, y hornear «Juárez Bus» aquí convertiría el
 * alta del siguiente en un despliegue.
 */
const NOMBRE = process.env.NEXT_PUBLIC_APP_NOMBRE ?? "Transporte público";

export const metadata: Metadata = {
  /*
   * Dónde vive Ontoy: `ontoy.app` (ASAV, 23-sep-2026). Con esto, todo lo que
   * Next arma en absoluto —lo que se comparte por WhatsApp, lo que lee un
   * buscador— apunta al dominio de la plataforma y no al de un transportista.
   * La misma variable que `next.config.ts`, para que no haya dos verdades.
   */
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITIO ?? "https://ontoy.app"),
  title: NOMBRE,
  description: "Dónde viene tu camión, en vivo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: NOMBRE, statusBarStyle: "default" },
  // iOS no lee el manifiesto para el ícono de inicio: quiere este PNG (`docs/Ontoy-Iconos.md`).
  // Va **sin transparencia**, y no por estética: iOS no maneja alfa aquí —compone lo
  // transparente sobre negro— y le pone SU propia máscara redondeada encima. El ícono
  // exportado trae esquinas transparentes con un radio distinto al de esa máscara, así que
  // cuánto negro se asoma depende de una curva que no controlamos: medido, entre 8 pixeles
  // y 296 según qué superelipse use iOS. Aplanado sobre Banqueta el riesgo no existe, y
  // cuesta 4 KB. Es también lo que pide `docs/Ontoy-Iconos.md` desde antes de esto.
  icons: { icon: "/icono.svg", apple: "/iconos/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Sin `maximumScale`: bloquear el zoom en una app que se usa en la calle deja
  // fuera a quien no ve de cerca. La accesibilidad gana al pixel perfect.
  /*
   * Los dos fondos de la identidad: **Banqueta `#EDE9E1`** de día y **Azul noche
   * `#1E2B4D`** de noche (handoff §4). El `#141225` de antes era el morado del
   * prototipo, que era lo único que quedaba de la piel vieja asomándose por la
   * barra del sistema — el color que el teléfono pinta arriba y abajo de la app
   * instalada, justo pegado a la pantalla.
   *
   * Van en literal y no en `var()` a propósito: esto lo lee el sistema
   * operativo, no el navegador, y ahí no hay hoja de estilos que resolver. Lo
   * cuida `piel-de-ontoy.test.ts`, que compara los dos contra la paleta.
   */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EDE9E1" },
    { media: "(prefers-color-scheme: dark)", color: "#1E2B4D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${bricolage.variable} ${instrumentSans.variable}`}>
      <body>
        {children}
        <RegistrarServicio />
      </body>
    </html>
  );
}
