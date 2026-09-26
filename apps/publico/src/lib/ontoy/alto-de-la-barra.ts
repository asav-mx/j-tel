"use client";

import { useEffect, useState } from "react";

/**
 * **Cuánto mide la barra de abajo, medido en vivo.** Para que las hojas que
 * suben sobre el mapa terminen donde ella empieza, y no la tapen.
 *
 * ## Por qué las hojas se detienen, en vez de subir la barra encima
 *
 * La barra es la salida de cualquier pantalla (8.10). Una hoja que la tapa deja
 * al pasajero sin ella, y un velo que la cubre convierte el primer toque en
 * «Inicio» en un «cerrar la hoja».
 *
 * El #592 lo resolvió al revés: le dio a `.ontoy-barra` un `z-index` para
 * pintarse encima. El #596 rehízo la barra —con razón, era otra barra— y esa
 * línea se fue con la regla vieja, junto con el comentario que decía por qué
 * existía. **Desde entonces la hoja tapaba la barra en producción**, y ninguna
 * prueba lo notó.
 *
 * Así que ahora la responsabilidad vive en las hojas, que son quienes la
 * causan: se detienen arriba de la barra. No queda nada en la regla de la barra
 * que alguien pueda borrar por accidente al rediseñarla.
 *
 * ## Por qué se mide y no se escribe
 *
 * El estándar dice 64 px más la zona segura; la barra del #596 mide otra cosa, y
 * la zona segura cambia de teléfono a teléfono. Un número escrito aquí se
 * separaría de la barra la próxima vez que alguien la toque. `ResizeObserver`
 * la sigue: si la barra cambia de alto —la palabra crece, el teléfono gira—, las
 * hojas se enteran solas.
 *
 * Sin barra en la pantalla devuelve 0, y las hojas llegan hasta abajo.
 */
export function useAltoDeLaBarra(): number {
  const [alto, setAlto] = useState(0);

  useEffect(() => {
    const barra = document.querySelector<HTMLElement>(".ontoy-barra");
    if (!barra) return;
    const medir = () => setAlto(Math.round(barra.getBoundingClientRect().height));
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ojo = new ResizeObserver(medir);
    ojo.observe(barra);
    return () => ojo.disconnect();
  }, []);

  return alto;
}
