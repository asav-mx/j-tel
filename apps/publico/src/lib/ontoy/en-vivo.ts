"use client";

import { useEffect, useRef, useState } from "react";
import { direccionEnVivo } from "@/lib/rutas-pedidas";
import { proximaEspera, SONDEO_MS } from "./ritmo-del-sondeo";
import type { Vivo } from "./forma";

/**
 * Los camiones de **varias rutas en una sola consulta** cada 15 s — las
 * favoritas del pasajero (Ontoy 2.0, PR 3b).
 *
 * Mismas reglas que `useRutaEnVivo`, que sigue sirviendo a la ruta abierta:
 * se detiene con la pestaña escondida, se aparta ante un 429 (`proximaEspera`),
 * y ante una falla **no borra** lo anterior: sigue en pantalla con su edad.
 *
 * La lista va ordenada y sin repetidas (`direccionEnVivo`): el mismo conjunto de
 * favoritas es la misma dirección, y el CDN la comparte entre teléfonos.
 */
export function useEnVivo(rutas: string[]): {
  vivos: Map<string, Vivo>;
  error: boolean;
  cargando: boolean;
  /** Ya llegó al menos una respuesta: una ruta que no viene en ella no existe para la app. */
  respondio: boolean;
} {
  const [vivos, setVivos] = useState<Map<string, Vivo>>(new Map());
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [respondio, setRespondio] = useState(false);
  const visible = useRef(true);
  const direccion = rutas.length > 0 ? direccionEnVivo(rutas) : null;

  useEffect(() => {
    if (!direccion) {
      setVivos(new Map());
      return;
    }
    let montado = true;
    const mirar = () => {
      visible.current = document.visibilityState === "visible";
    };
    mirar();
    document.addEventListener("visibilitychange", mirar);

    let espera = SONDEO_MS;
    let id: ReturnType<typeof setTimeout> | undefined;
    setCargando(true);

    const pedir = async () => {
      let status: number | null = null;
      let retryAfter: string | null = null;
      if (visible.current) {
        try {
          const r = await fetch(direccion);
          status = r.status;
          retryAfter = r.headers.get("retry-after");
          if (!r.ok) throw new Error(String(r.status));
          const cuerpo: { rutas: Record<string, Vivo> } = await r.json();
          if (montado) {
            setVivos(new Map(Object.entries(cuerpo.rutas)));
            setRespondio(true);
            setError(false);
          }
        } catch {
          if (montado) setError(true);
        } finally {
          if (montado) setCargando(false);
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
  }, [direccion]);

  return { vivos, error, cargando, respondio };
}
