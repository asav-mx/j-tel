import localFont from "next/font/local";

/*
 * La letra de la LANDING — Bricolage Grotesque e Instrument Sans.
 *
 * Es otra que la de la app (Archivo + IBM Plex, decisión de ASAV del 21-sep), y
 * es a propósito: la landing nace con los tokens del sistema de diseño
 * (`.claude/skills/ontoy-design/tokens/typography.css`), que es con lo que está
 * dibujada la portada aprobada. La app cambia a los tokens en su propio PR;
 * mientras tanto conviven, y **nadie baja las seis**: el navegador sólo pide
 * los archivos que declara la página que abrió, y son dos páginas distintas.
 *
 * ## Autoalojadas, como todo lo de este repo
 *
 * `next/font/google` **descarga los archivos durante `next build`**: si Google
 * no contesta, no falla la tipografía — falla la compilación. Pasó tres veces
 * (#294 en la web, #493 y #498 en Ontoy) y la valla
 * `scripts/verificar-fuentes-locales.mjs` tumba CI si alguien vuelve a
 * importarlo. Los `.woff2` viven en `src/app/fuentes/` y se regeneran con
 * `pnpm --filter @jtel/publico fuentes:traer`.
 *
 * ## Las dos son VARIABLES
 *
 * Un archivo para todos los pesos, así que se declara el RANGO. Declarar pesos
 * sueltos sobre el mismo archivo haría que el navegador sintetizara el grueso
 * engrosando el delgado — y el titular de Ontoy vive justo del grueso.
 *
 * Bricolage trae además el eje `opsz`, que reajusta el dibujo según el tamaño
 * al que se vea. **No se fija**: es lo que hace que el título de 76 px y la
 * placa de 14 px estén dibujados cada uno para su tamaño, y es como está
 * dibujada la landing aprobada. Lo que cuesta está medido en
 * `src/app/fuentes/LEEME.md`.
 */

export const bricolage = localFont({
  src: [
    {
      path: "../../app/fuentes/bricolage-variable.woff2",
      weight: "600 800",
      style: "normal",
    },
  ],
  variable: "--fuente-bricolage",
  display: "swap",
});

export const instrumentSans = localFont({
  src: [
    {
      path: "../../app/fuentes/instrument-sans-variable.woff2",
      weight: "400 700",
      style: "normal",
    },
  ],
  variable: "--fuente-instrument",
  display: "swap",
});
