/**
 * Fija el tema antes del primer pintado.
 *
 * Va como primer hijo de `<body>` y es síncrono a propósito: el navegador lo
 * ejecuta antes de pintar lo que sigue, así que nadie ve el destello de un
 * tema que no eligió.
 *
 * **Por qué un script y no `@media (prefers-color-scheme)`.** La alternativa
 * sería repetir la paleta clara completa dentro de una media query, y entonces
 * los mismos treinta valores vivirían en dos lugares. Con esto, el CSS solo
 * necesita `[data-tema="claro"]` y la preferencia del sistema se resuelve aquí:
 * una sola fuente de verdad para los colores.
 *
 * El orden de decisión es el del skill: **lo que el usuario eligió gana; si no
 * ha elegido, manda el sistema operativo.**
 *
 * Se recuerda en `localStorage`, o sea por navegador. El skill dice "por
 * usuario", y eso llegará cuando exista `auth-rbac` y haya dónde guardarlo —
 * hoy no hay tabla de preferencias en el esquema. El nombre de la llave ya
 * está listo para migrar sin cambiar el componente.
 */

export const LLAVE_TEMA = "jtel-tema";

const GUION = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(LLAVE_TEMA)});
    if (t !== "claro" && t !== "oscuro") {
      t = matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "oscuro";
    }
    document.documentElement.dataset.tema = t;
  } catch (e) {
    /* Sin localStorage (modo privado, permisos) el producto sigue funcionando
       en su tema canónico. Un interruptor roto no puede tumbar la pantalla. */
    document.documentElement.dataset.tema = "oscuro";
  }
})();
`;

export function TemaInicial() {
  return <script dangerouslySetInnerHTML={{ __html: GUION }} />;
}
