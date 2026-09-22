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
  | "negada";

export interface Ubicacion {
  yo: { lat: number; lon: number } | null;
  estado: EstadoDeUbicacion;
  /** Pide el permiso (sólo tras un toque del pasajero) y empieza a leer. */
  pedir: () => void;
}

export function useUbicacion({ pedirAlAbrir }: { pedirAlAbrir: boolean }): Ubicacion {
  const [yo, setYo] = useState<{ lat: number; lon: number } | null>(null);
  const [estado, setEstado] = useState<EstadoDeUbicacion>("sin-pedir");
  const vigilancia = useRef<number | null>(null);

  const leer = useCallback(() => {
    if (vigilancia.current !== null) return;
    if (!("geolocation" in navigator)) {
      setEstado("no-disponible");
      return;
    }
    setEstado((e) => (e === "concedida" ? e : "buscando"));
    vigilancia.current = navigator.geolocation.watchPosition(
      (p) => {
        setYo({ lat: p.coords.latitude, lon: p.coords.longitude });
        setEstado("concedida");
      },
      (err) => {
        /* Sin permiso la app sigue sirviendo. No se insiste ni se bloquea. */
        if (err.code === err.PERMISSION_DENIED) {
          setEstado("negada");
          if (vigilancia.current !== null) navigator.geolocation.clearWatch(vigilancia.current);
          vigilancia.current = null;
        }
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

  return { yo, estado, pedir: leer };
}

/**
 * La forma de antes, para el buscador: pide al abrir porque el pasajero llegó
 * a esa pantalla a preguntar desde dónde sale. Devuelve `null` mientras no haya
 * permiso o no haya llegado el primer fix, y **eso no es un error**.
 */
export function useMiUbicacion(): { lat: number; lon: number } | null {
  return useUbicacion({ pedirAlAbrir: true }).yo;
}
