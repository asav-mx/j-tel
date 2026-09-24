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
 *
 * ## Estuvo sin horario del 22 al 29 de septiembre de 2026
 *
 * La semana del arranque era de calibración y este resumen **todavía no lo lee
 * nadie** —el planeador llega después—, así que se le quitó el horario, no la
 * ruta (#513, decisión de ASAV del 22-sep). **Su renglón volvió a
 * `vercel.json` el 29**, a la misma hora que tenía: `10 7 * * *`.
 *
 * Se deja escrito en vez de borrarlo: quien mire el historial de `vercel.json`
 * y vea el renglón irse y volver merece encontrar aquí por qué, sin tener que
 * abrir dos PRs. Y `?simular=…` sigue siendo la forma de ver una ronda sin
 * escribir, con horario o sin él.
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
