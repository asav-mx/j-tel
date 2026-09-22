import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { paradasDeLaCiudad } from "@/lib/paradas-de-la-ciudad";

/**
 * Las paradas de toda la ciudad — sólo lo público, cero mediciones.
 * Qué lleva y por qué, en `lib/paradas-de-la-ciudad.ts`.
 *
 * Se pide **sólo** cuando el pasajero toca «Ver paradas cerca de mí», no al
 * abrir: en un teléfono con datos contados, lo que no se usa no se baja.
 *
 * **Vive bajo `/api/circuitos/`** (se mudó de `/api/paradas` el 22-sep): es el
 * prefijo de la regla del firewall, y fuera de él ninguna regla la cubría.
 *
 * GET sin parámetros, igual para todos: no hay nada del pasajero que pueda
 * viajar en él. Mismo caché que la forma de una ruta — una parada cambia
 * cuando alguien la mueve media cuadra, no cada minuto.
 */

const TTL_SEGUNDOS = 300;
const REVALIDAR_SEGUNDOS = 3600;

export async function GET() {
  const lista = await paradasDeLaCiudad(getRepos().circuits);
  return NextResponse.json(lista, {
    headers: {
      "cache-control": `public, s-maxage=${TTL_SEGUNDOS}, stale-while-revalidate=${REVALIDAR_SEGUNDOS}`,
    },
  });
}
