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

  return {
    guardadas: ids,
    disponible,
    listo,
    alternar,
    estaGuardada: (parada: string) => ids.some((x) => x.parada === parada),
  };
}
