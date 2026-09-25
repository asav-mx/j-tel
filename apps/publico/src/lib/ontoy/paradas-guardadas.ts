"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Las paradas guardadas — **en el teléfono, nunca en un servidor** (8.8b).
 *
 * La Pieza 8 descartó una tercera vista y puso esto en su lugar: lo que el
 * pasajero de todos los días necesita no es otra pantalla, es llegar en un toque
 * a su parada. Y guardarla **no identifica a nadie** (8.7): no hay cuenta, no
 * hay petición, no hay nada que viaje. Vive en `localStorage` y ahí se queda.
 *
 * ## Por qué cada lectura y cada escritura va en try/catch
 *
 * `localStorage` truena —no devuelve vacío, **lanza**— en una ventana privada de
 * Safari y con las cookies de sitio bloqueadas. Sin el catch, guardar una parada
 * tumbaría la pantalla entera del pasajero que más cuidado tiene con sus datos,
 * que es exactamente al que esta app le está prometiendo algo.
 *
 * Sin `localStorage` la app **sigue sirviendo completa**: lo único que se pierde
 * es el atajo, y las paradas guardadas se dibujan vacías con su frase.
 *
 * ## Por qué el estado arranca vacío y se llena al montar
 *
 * El servidor no tiene `localStorage`, así que leerlo durante el primer dibujo
 * daría un HTML distinto del que el navegador arma después. Se lee en un efecto,
 * después de montar: el primer cuadro no tiene guardadas y el segundo sí.
 */

const LLAVE = "ontoy:paradas-guardadas";

/**
 * Una parada guardada, con **la ruta a la que pertenece**.
 *
 * Guardar sólo el slug de la parada obligaría a barrer todas las rutas
 * publicadas para saber de cuál es —y a pedirlas todas para enseñar un atajo—.
 * Con la ruta al lado, el atajo pide exactamente lo que necesita. Los dos son
 * identidades públicas (el slug del QR y el del circuito): no identifican a
 * nadie, y de todos modos no salen del teléfono.
 */
export interface ParadaGuardada {
  parada: string;
  ruta: string;
}

const esGuardada = (x: unknown): x is ParadaGuardada =>
  typeof x === "object" && x !== null &&
  typeof (x as ParadaGuardada).parada === "string" &&
  typeof (x as ParadaGuardada).ruta === "string";

function leer(): ParadaGuardada[] {
  try {
    const crudo = window.localStorage.getItem(LLAVE);
    if (!crudo) return [];
    const valor: unknown = JSON.parse(crudo);
    return Array.isArray(valor) ? valor.filter(esGuardada) : [];
  } catch {
    return [];
  }
}

function escribir(ids: ParadaGuardada[]): void {
  try {
    window.localStorage.setItem(LLAVE, JSON.stringify(ids));
  } catch {
    /* Sin dónde guardar, la app sigue: se pierde el atajo, no la pantalla. */
  }
}

/**
 * **Mover una parada de un lugar a otro de la lista.** Pura, y por eso probable
 * sin arrastrar nada con el dedo.
 *
 * Los índices se recortan a la lista en vez de reventar: un gesto que se suelta
 * fuera de la lista manda un índice de más, y lo correcto ahí es dejarla al
 * final —que es donde el dedo la soltó— y no perder la parada.
 */
export function mover<T>(lista: T[], desde: number, hasta: number): T[] {
  if (desde < 0 || desde >= lista.length) return lista;
  const destino = Math.min(Math.max(hasta, 0), lista.length - 1);
  if (destino === desde) return lista;
  const copia = [...lista];
  const [pieza] = copia.splice(desde, 1);
  copia.splice(destino, 0, pieza);
  return copia;
}

export function useParadasGuardadas() {
  const [ids, setIds] = useState<ParadaGuardada[]>([]);
  /**
   * Si el navegador dejó leer. `false` no es «no hay guardadas»: es «aquí no se
   * puede guardar», y la pantalla lo dice distinto.
   */
  const [disponible, setDisponible] = useState(true);
  /**
   * Si ya se leyó el teléfono. Antes de eso la lista vacía no significa «no
   * guardas ninguna»: Inicio esperaría un instante enseñando las paradas cerca
   * a quien sí tiene guardadas, y luego brincaría.
   */
  const [listo, setListo] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.getItem(LLAVE);
      setIds(leer());
    } catch {
      setDisponible(false);
    }
    setListo(true);
  }, []);

  const alternar = useCallback((g: ParadaGuardada) => {
    setIds((antes) => {
      const siguiente = antes.some((x) => x.parada === g.parada)
        ? antes.filter((x) => x.parada !== g.parada)
        : [...antes, g];
      escribir(siguiente);
      return siguiente;
    });
  }, []);

  /**
   * **Reordenar.** El orden del arreglo ES el orden de la pantalla: la primera
   * guardada es la que Inicio enseña arriba, que es la parada de todos los días.
   */
  const reordenar = useCallback((desde: number, hasta: number) => {
    setIds((antes) => {
      const siguiente = mover(antes, desde, hasta);
      if (siguiente !== antes) escribir(siguiente);
      return siguiente;
    });
  }, []);

  /**
   * **Quitar, con su deshacer.**
   *
   * Devuelve lo necesario para reponerla **en su lugar**, no al final: quitar
   * por error una parada de en medio y que reaparezca hasta abajo es deshacer a
   * medias — el pasajero tendría que volver a ordenarla.
   *
   * No hay confirmación antes, y es a propósito: una pregunta por cada quitada
   * cansa, y lo que protege de verdad es poder deshacer después (estándar:
   * «nada de alarmas»).
   */
  const quitar = useCallback(
    (parada: string): { g: ParadaGuardada; en: number } | null => {
      /*
       * **Se lee de `ids`, no de dentro del actualizador.**
       *
       * La primera versión sacaba el valor desde dentro de `setIds(antes => …)`
       * y lo devolvía después. **Siempre devolvía `null`**: el actualizador es
       * una función que React corre cuando quiere, así que para cuando `quitar`
       * volvía, todavía no había corrido. El botón funcionaba —la parada se
       * iba— y el «Deshacer» no aparecía nunca. Lo enseñó la prueba en el
       * navegador; no lo veía ninguna prueba unitaria y compilaba perfecto.
       */
      const en = ids.findIndex((x) => x.parada === parada);
      if (en < 0) return null;
      const quitada = { g: ids[en], en };
      const siguiente = ids.filter((_, i) => i !== en);
      escribir(siguiente);
      setIds(siguiente);
      return quitada;
    },
    [ids],
  );

  /** Reponer una quitada en el lugar donde estaba. */
  const reponer = useCallback((g: ParadaGuardada, en: number) => {
    setIds((antes) => {
      if (antes.some((x) => x.parada === g.parada)) return antes;
      const siguiente = [...antes];
      siguiente.splice(Math.min(en, siguiente.length), 0, g);
      escribir(siguiente);
      return siguiente;
    });
  }, []);

  return {
    guardadas: ids,
    disponible,
    listo,
    alternar,
    reordenar,
    quitar,
    reponer,
    estaGuardada: (parada: string) => ids.some((x) => x.parada === parada),
  };
}
