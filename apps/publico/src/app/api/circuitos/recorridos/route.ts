import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { recorridosDeLaCiudad } from "@/lib/recorridos-de-la-ciudad";

/**
 * Los **recorridos por tramo** de las rutas publicadas (Marco 8.16.5; 0053).
 *
 * Lo que el planeador necesita para poder dar un total: cuánto tarda un camión
 * de una parada a la siguiente. **Del circuito y agregado**, nunca por
 * transportista ni por unidad.
 *
 * **Lee sólo el resumen** que escribe el cron (`circuit_leg_times`): los pasos
 * del detector viven detrás del muro de cuenta (9.14) y el camino del pasajero
 * no los toca. Qué lleva y por qué, en `lib/recorridos-de-la-ciudad.ts`.
 *
 * Caché de una hora: el resumen se recalcula una vez al día.
 */

const TTL_SEGUNDOS = 3600;
const REVALIDAR_SEGUNDOS = 21_600;

export async function GET() {
  const rutas = await recorridosDeLaCiudad(getRepos().circuits);
  return NextResponse.json(
    { rutas },
    {
      headers: {
        "cache-control": `public, s-maxage=${TTL_SEGUNDOS}, stale-while-revalidate=${REVALIDAR_SEGUNDOS}`,
      },
    },
  );
}
