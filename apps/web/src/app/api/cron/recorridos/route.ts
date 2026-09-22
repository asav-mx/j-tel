import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { ResumenDeRecorridosService } from "@jtel/services";

export const maxDuration = 300;

/**
 * Calcula el **resumen de los recorridos por tramo** (0053; Marco 8.16.5).
 *
 * Diario: lee los pasos de los últimos 7 días por circuito publicado y
 * reemplaza el resumen que lee la app del pasajero. El pasajero **nunca** toca
 * los pasos: eso vive detrás del muro de cuenta (9.14), y esta ronda es la
 * única lectura sin cuenta — sin puerta a internet, detrás de `CRON_SECRET`.
 *
 * `?simular=…` calcula y no escribe, para ver una ronda sin tocar nada.
 */
export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/recorridos");
  if (negada) return negada;

  // Cualquier valor presente simula, salvo "0": un error de dedo no puede convertirse en escritura.
  const parametro = new URL(request.url).searchParams.get("simular");
  const simular = parametro !== null && parametro !== "0";

  const ronda = await new ResumenDeRecorridosService(getRepos()).correr({ simular });
  const { detalle: _detalle, ...resumen } = ronda;
  console.log("[cron/recorridos]", JSON.stringify(resumen));
  return NextResponse.json(ronda);
}

/** Vercel puede llamar un cron por POST; misma guardia y mismo trabajo. */
export async function POST(request: Request) {
  return GET(request);
}
