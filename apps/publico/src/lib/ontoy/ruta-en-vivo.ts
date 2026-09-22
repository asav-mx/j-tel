"use client";

import { useEffect, useState } from "react";
import type { Forma } from "./forma";

/*
 * ✎ 22-sep-2026 (PR 4b): aquí vivía `useRutaEnVivo`, que sondeaba los camiones
 * de la ruta abierta por su cuenta cada 15 s. Se retiró: los camiones de la ruta
 * abierta llegan ahora en la consulta única de la raíz (`useEnVivo` con
 * `rutasDeLaConsulta`), junto con tus favoritas — 4 peticiones por minuto en
 * toda la app en vez de 8. Las dos reglas que ese sondeo cuidaba siguen, en
 * `en-vivo.ts`: el error es un estado propio y lo último que se supo no se
 * borra; y quince segundos, no menos, con el paso bajado tras un 429.
 *
 * Queda la forma, que no se sondea.
 */

/**
 * La FORMA de una ruta —trazados y paradas—, sin sondeo: baja una vez y se
 * queda (el endpoint lleva caché largo). La usan la ruta abierta y cada tarjeta
 * de Inicio; los camiones de las tarjetas llegan todos juntos por `useEnVivo`,
 * en una sola consulta (PR 3b).
 */
export function useForma(circuitoId: string | null, intento = 0): { forma: Forma | null; error: boolean; cargando: boolean } {
  const [forma, setForma] = useState<Forma | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!circuitoId) {
      setForma(null);
      return;
    }
    let montado = true;
    setCargando(true);
    void (async () => {
      try {
        const f = await formaCompartida(circuitoId, intento > 0);
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

  return { forma, error, cargando };
}

/**
 * Una sola petición por forma, aunque la pidan varias tarjetas a la vez: dos
 * paradas guardadas de la misma ruta pedían su forma dos veces (lo enseñó el
 * conteo de peticiones del PR 3b). Vive lo mismo que en el CDN, cinco minutos;
 * un reintento la vuelve a pedir, y una falla no se queda guardada.
 */
const VIGENCIA_FORMA_MS = 5 * 60_000;
const formas = new Map<string, { desde: number; promesa: Promise<Forma> }>();

function formaCompartida(circuitoId: string, forzar: boolean): Promise<Forma> {
  const hay = formas.get(circuitoId);
  if (hay && !forzar && Date.now() - hay.desde < VIGENCIA_FORMA_MS) return hay.promesa;
  const promesa = fetch(`/api/circuitos/${circuitoId}`).then(async (r) => {
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as Forma;
  });
  formas.set(circuitoId, { desde: Date.now(), promesa });
  promesa.catch(() => formas.delete(circuitoId));
  return promesa;
}
