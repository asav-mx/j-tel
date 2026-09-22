"use client";

import { useEffect, useState } from "react";
import type { ParadasDeLaCiudad } from "@/lib/paradas-de-la-ciudad";

/**
 * La lista pública de paradas de la ciudad (`/api/circuitos/paradas-de-la-ciudad`),
 * bajada una vez y sólo cuando `haceFalta`. La usan Inicio (las paradas cerca
 * de ti) y el Mapa de la ciudad (dónde están tus paradas guardadas). El
 * endpoint lleva caché largo; la petición no lleva nada del pasajero.
 */
export function useParadasDeLaCiudad(haceFalta: boolean) {
  const [datos, setDatos] = useState<ParadasDeLaCiudad | null>(null);
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!haceFalta || datos) return;
    let vivo = true;
    setError(false);
    fetch("/api/circuitos/paradas-de-la-ciudad")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json() as Promise<ParadasDeLaCiudad>;
      })
      .then((d) => vivo && setDatos(d))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [haceFalta, datos, intento]);

  return { datos, error, reintentar: () => setIntento((n) => n + 1) };
}
