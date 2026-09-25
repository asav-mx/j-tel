"use client";

import { useEffect, useRef } from "react";

/**
 * El contador anónimo de aperturas — **la única escritura de toda la app.**
 *
 * Dice una cosa y sólo una: alguien abrió esta ruta, una vez. El servidor deriva
 * la huella de lo que la petición ya traía (IP + agente + día civil del circuito
 * + circuito, por HMAC) y **no guarda ni la IP ni el agente**; la huella rota
 * con el día, así que de aquí no sale «cuántos volvieron».
 *
 * **Nada se guarda en el teléfono** para esto: ni cookie, ni `localStorage`, ni
 * identificador que viaje de vuelta. Y el cuerpo de la petición va vacío — no
 * lleva ubicación, ni nada del pasajero.
 *
 * Es lo que la Pieza 8 permite como única medición sobre el pasajero (8.7):
 * cuenta aperturas, no personas.
 *
 * **Una por ruta y por sesión**, no una por cuadro: sin el candado, cada
 * re-render mandaría otra. El servidor deduplica por día de todos modos, pero
 * mandar diez peticiones para que nueve se tiren es gastarle los datos a alguien.
 */
export function useContarApertura(circuitoId: string | null): void {
  const mandadas = useRef(new Set<string>());

  useEffect(() => {
    if (!circuitoId || mandadas.current.has(circuitoId)) return;
    mandadas.current.add(circuitoId);
    void fetch(`/api/circuitos/${circuitoId}/apertura`, { method: "POST", keepalive: true }).catch(
      () => {
        /* Un contador no rompe una pantalla. */
      },
    );
  }, [circuitoId]);
}

/**
 * **«Abrió una parada»** — el contador hermano, y una cifra aparte.
 *
 * Desde el #592, tocar una parada en el mapa ya **no** abre la ruta: la hoja se
 * abre encima del mapa. Eso dejó al contador de rutas sin ver el gesto más común
 * de la app, y sumar las dos cosas en la misma cifra habría hecho que «abrió una
 * ruta» empezara a significar otra cosa de un día para otro, sin aviso.
 *
 * Así que son dos contadores, dos tablas y dos preguntas (ASAV, 25-sep). Éste
 * cuenta **las tres formas de llegar a la hoja**: tocar la parada en el mapa de
 * la ciudad, tocarla dentro de una ruta abierta, y escanear su letrero.
 *
 * Mismo candado que el otro: **una por parada y por sesión**, no una por cuadro.
 */
export function useContarAperturaDeParada(
  circuitoId: string | null,
  paradaId: string | null,
): void {
  const mandadas = useRef(new Set<string>());

  useEffect(() => {
    if (!circuitoId || !paradaId) return;
    const llave = `${circuitoId}/${paradaId}`;
    if (mandadas.current.has(llave)) return;
    mandadas.current.add(llave);
    void fetch(`/api/circuitos/${circuitoId}/paradas/${paradaId}/apertura`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {
      /* Un contador no rompe una pantalla. */
    });
  }, [circuitoId, paradaId]);
}
