"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Dónde está el pasajero. **Nunca sale del teléfono.**
 *
 * No es una promesa de política: no hay ninguna petición en esta app que la
 * mande. `watchPosition` corre aquí, y lo que se calcula con el resultado —la
 * llegada, las paradas cercanas, y si una ruta te sirve— se calcula aquí también.
 *
 * Salió de `vista-pasajero.tsx` cuando el buscador la necesitó igual. Dos
 * copias de esto serían dos lugares donde alguien puede, sin querer, mandarla a
 * algún lado; una sola es un solo lugar que revisar. Por eso las dos maneras de
 * pedirla viven aquí, y `watchPosition` se llama en un solo renglón.
 *
 * ## Ontoy no pregunta al abrir (decisión de ASAV, 22-sep)
 *
 * El permiso se pide cuando el pasajero toca «Ver paradas cerca de mí», no al
 * abrir la app: abrir una app de camiones no es aceptar que lea dónde estás, y
 * la app completa sirve sin ubicación (8.7). Si el permiso **ya se dio antes**,
 * se usa sin volver a preguntar — el navegador no enseña ninguna ventana, y la
 * llegada hasta el pasajero (8.3b) sigue funcionando para quien ya dijo que sí.
 *
 * Saber si ya se dio se lee con `navigator.permissions`, que **no pregunta**. Si
 * el navegador no lo tiene, se trata como «no se ha pedido»: ante la duda, no
 * se pregunta.
 */

export type EstadoDeUbicacion =
  /** El teléfono no sabe dar ubicación, o el navegador no la ofrece. */
  | "no-disponible"
  /** Nadie ha preguntado todavía. No se pregunta sin un toque. */
  | "sin-pedir"
  /** Se preguntó (o ya estaba concedida) y todavía no llega la primera lectura. */
  | "buscando"
  /** Hay posición. */
  | "concedida"
  /** El pasajero dijo que no, o lo quitó en ajustes. No se insiste. */
  | "negada"
  /**
   * Hay permiso, pero el teléfono no da posición: GPS apagado, sin señal, o se
   * agotó el tiempo. **No es un «no» del pasajero**, y no se confunde con él:
   * se dice distinto y se puede reintentar. Antes se quedaba en «buscando»
   * para siempre (bug del 22-sep-2026).
   */
  | "sin-senal";

export interface Ubicacion {
  yo: { lat: number; lon: number } | null;
  estado: EstadoDeUbicacion;
  /** Pide el permiso (sólo tras un toque del pasajero) y empieza a leer. */
  pedir: () => void;
  /** Vuelve a empezar la lectura: tras «sin señal», cuando el pasajero prende su GPS. */
  reintentar: () => void;
}

/**
 * Qué estado deja un error de `watchPosition`. Pura, para probarla sin GPS.
 *
 * - 1 (PERMISSION_DENIED): el pasajero dijo que no → «negada».
 * - 2 (POSITION_UNAVAILABLE) y 3 (TIMEOUT): hay permiso y no hay posición. Si
 *   ya había una, se conserva —un túnel no borra dónde estabas— y si nunca
 *   llegó ninguna, «sin-senal», que la pantalla dice con su salida.
 */
export function estadoTrasError(codigo: number, hayPosicion: boolean): EstadoDeUbicacion {
  if (codigo === 1) return "negada";
  return hayPosicion ? "concedida" : "sin-senal";
}

export function useUbicacion({ pedirAlAbrir }: { pedirAlAbrir: boolean }): Ubicacion {
  const [yo, setYo] = useState<{ lat: number; lon: number } | null>(null);
  const [estado, setEstado] = useState<EstadoDeUbicacion>("sin-pedir");
  const vigilancia = useRef<number | null>(null);
  /** Si ya llegó alguna posición: un error después de eso no la borra. */
  const huboPosicion = useRef(false);

  const leer = useCallback(() => {
    if (vigilancia.current !== null) return;
    if (!("geolocation" in navigator)) {
      setEstado("no-disponible");
      return;
    }
    setEstado((e) => (e === "concedida" ? e : "buscando"));
    vigilancia.current = navigator.geolocation.watchPosition(
      (p) => {
        huboPosicion.current = true;
        setYo({ lat: p.coords.latitude, lon: p.coords.longitude });
        setEstado("concedida");
      },
      (err) => {
        /* Sin permiso la app sigue sirviendo. No se insiste ni se bloquea. */
        if (err.code === 1) {
          setEstado("negada");
          if (vigilancia.current !== null) navigator.geolocation.clearWatch(vigilancia.current);
          vigilancia.current = null;
          return;
        }
        /*
         * Sin señal o sin GPS: la vigilancia SIGUE —si el GPS vuelve, la
         * posición llega sola— y la pantalla lo dice con «Reintentar».
         */
        setEstado(estadoTrasError(err.code, huboPosicion.current));
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setEstado("no-disponible");
      return;
    }
    if (pedirAlAbrir) {
      leer();
    } else {
      let vivo = true;
      navigator.permissions
        ?.query({ name: "geolocation" })
        .then((p) => {
          if (!vivo) return;
          if (p.state === "granted") leer();
          else if (p.state === "denied") setEstado("negada");
        })
        .catch(() => {
          /* Sin forma de saberlo sin preguntar: se espera al toque. */
        });
      return () => {
        vivo = false;
        if (vigilancia.current !== null) navigator.geolocation.clearWatch(vigilancia.current);
        vigilancia.current = null;
      };
    }
    return () => {
      if (vigilancia.current !== null) navigator.geolocation.clearWatch(vigilancia.current);
      vigilancia.current = null;
    };
  }, [pedirAlAbrir, leer]);

  const reintentar = useCallback(() => {
    if (vigilancia.current !== null) navigator.geolocation.clearWatch(vigilancia.current);
    vigilancia.current = null;
    leer();
  }, [leer]);

  return { yo, estado, pedir: leer, reintentar };
}

/**
 * La forma de antes, para el buscador: pide al abrir porque el pasajero llegó
 * a esa pantalla a preguntar desde dónde sale. Devuelve `null` mientras no haya
 * permiso o no haya llegado el primer fix, y **eso no es un error**.
 */
export function useMiUbicacion(): { lat: number; lon: number } | null {
  return useUbicacion({ pedirAlAbrir: true }).yo;
}
