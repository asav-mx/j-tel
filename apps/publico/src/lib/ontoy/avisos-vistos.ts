"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Qué avisos de la concesión ya viste, **en el teléfono** — para que el punto
 * de la campana se apague cuando los lees (PR 4b). No viaja a ningún lado.
 *
 * Se guardan sólo los ids de los avisos que siguen vigentes: uno que ya no
 * llega (retirado o vencido) se olvida, y la lista no crece para siempre.
 */
const LLAVE = "ontoy:avisos-vistos";

function leer(): Set<string> {
  try {
    const crudo = window.localStorage.getItem(LLAVE);
    const valor: unknown = crudo ? JSON.parse(crudo) : [];
    return new Set(Array.isArray(valor) ? valor.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function useAvisosVistos() {
  const [vistos, setVistos] = useState<Set<string>>(new Set());
  useEffect(() => setVistos(leer()), []);

  /** Marca como vistos los avisos que están en pantalla, y olvida los que ya no existen. */
  const marcarVistos = useCallback((vigentes: string[]) => {
    const siguiente = new Set(vigentes);
    setVistos(siguiente);
    try {
      window.localStorage.setItem(LLAVE, JSON.stringify([...siguiente]));
    } catch {
      /* Sin dónde guardar, el punto vuelve a salir la próxima vez. La campana sigue sirviendo. */
    }
  }, []);

  return { vistos, marcarVistos };
}
