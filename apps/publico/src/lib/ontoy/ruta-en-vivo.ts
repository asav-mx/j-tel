"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Forma, Vivo } from "./forma";
import { proximaEspera, SONDEO_MS } from "./ritmo-del-sondeo";

/**
 * La ruta en vivo — la forma una vez, y las unidades cada quince segundos.
 *
 * ## El estado de red es parte del contrato, no un extra
 *
 * El prototipo no lo tenía, y sin él una falla de red se ve **idéntica** a un
 * servicio sin camiones: los dos dibujan una pantalla sin unidades. Uno es
 * «hoy no pasa nadie» y el otro es «no pudimos preguntar», y el pasajero que
 * los confunde se queda parado en la banqueta por la razón equivocada.
 *
 * Por eso `error` es un estado propio, y **lo último que se supo no se borra**:
 * cuando un sondeo falla, se conserva lo anterior con su edad y se dice que está
 * viejo. Borrarlo dejaría la pantalla en blanco justo cuando el dato de hace
 * treinta segundos todavía sirve.
 *
 * ## Quince segundos, y no menos
 *
 * Es el TTL del CDN: sondear más seguido no trae dato más fresco y sí gasta
 * los datos del teléfono de alguien. Tras un 429 del firewall el paso se baja
 * solo y vuelve al primer éxito — ver `ritmo-del-sondeo.ts`.
 */

export interface RutaEnVivo {
  forma: Forma | null;
  vivo: Vivo | null;
  /** Hubo una falla de red y lo que se muestra es lo último que se supo. */
  error: boolean;
  /** Todavía no llega la primera respuesta. Distinto de `error` y de «sin unidades». */
  cargando: boolean;
  reintentar: () => void;
}

export function useRutaEnVivo(circuitoId: string | null): RutaEnVivo {
  const [forma, setForma] = useState<Forma | null>(null);
  const [vivo, setVivo] = useState<Vivo | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [intento, setIntento] = useState(0);
  const visible = useRef(true);

  const reintentar = useCallback(() => setIntento((n) => n + 1), []);

  // La forma cambia cuando alguien publica, no cada quince segundos.
  useEffect(() => {
    if (!circuitoId) {
      setForma(null);
      setVivo(null);
      return;
    }
    let montado = true;
    setCargando(true);
    void (async () => {
      try {
        const r = await fetch(`/api/circuitos/${circuitoId}`);
        if (!r.ok) throw new Error(String(r.status));
        const f: Forma = await r.json();
        if (montado) {
          setForma(f);
          setError(false);
        }
      } catch {
        if (montado) setError(true);
      } finally {
        if (montado) setCargando(false);
      }
    })();
    return () => {
      montado = false;
    };
  }, [circuitoId, intento]);

  /*
   * El sondeo se detiene con la pestaña escondida: un teléfono en el bolsillo
   * no está mirando nada, y seguir pidiendo le gasta batería y datos a alguien
   * que no está leyendo la pantalla.
   */
  useEffect(() => {
    if (!circuitoId) return;
    let montado = true;

    const mirar = () => {
      visible.current = document.visibilityState === "visible";
    };
    mirar();
    document.addEventListener("visibilitychange", mirar);

    /*
     * Una cadena de `setTimeout`, no un `setInterval`: la espera siguiente
     * depende de cómo contestó ésta (un 429 pide apartarse).
     */
    let espera = SONDEO_MS;
    let id: ReturnType<typeof setTimeout> | undefined;

    const pedir = async () => {
      let status: number | null = null;
      let retryAfter: string | null = null;
      if (visible.current) {
        try {
          const r = await fetch(`/api/circuitos/${circuitoId}/unidades`);
          status = r.status;
          retryAfter = r.headers.get("retry-after");
          if (!r.ok) throw new Error(String(r.status));
          const v: Vivo = await r.json();
          if (montado) {
            setVivo(v);
            setError(false);
          }
        } catch {
          // Lo anterior NO se borra: sigue sirviendo, con su edad a la vista.
          if (montado) setError(true);
        }
        espera = proximaEspera(status, retryAfter, espera);
      }
      if (montado) id = setTimeout(() => void pedir(), espera);
    };

    void pedir();
    return () => {
      montado = false;
      clearTimeout(id);
      document.removeEventListener("visibilitychange", mirar);
    };
  }, [circuitoId, intento]);

  return { forma, vivo, error, cargando, reintentar };
}
