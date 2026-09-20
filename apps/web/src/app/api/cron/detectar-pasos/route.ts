import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { OrquestadorDePasosService } from "@jtel/services";

export const maxDuration = 300;

/**
 * La ronda del detector de pasos por parada (Marco 9.2 / 9.11). Delgada, como
 * `verify`: la lógica vive en `OrquestadorDePasosService`.
 *
 * **`?simular=1` corre todo y no deja nada**: cada unidad hace su ronda dentro de
 * su transacción y la revierte al final. La respuesta trae lo que se habría
 * escrito —los pasos y hasta dónde habría quedado el marcador— para verlo antes
 * de dejar que el cron escriba solo.
 */
export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/detectar-pasos");
  if (negada) return negada;

  // Cualquier valor presente simula, salvo "0": quien escribe `?simular=true` o `?simular=si`
  // quiere ver sin escribir, y un error de dedo no puede convertirse en una escritura real.
  const parametro = new URL(request.url).searchParams.get("simular");
  const simular = parametro !== null && parametro !== "0";
  const service = new OrquestadorDePasosService(getRepos());
  const ronda = await service.correr({ simular });

  // Sin el detalle: el registro dice cuánto se hizo, la respuesta dice qué.
  const { detalle: _detalle, ...resumen } = ronda;
  console.log("[cron/detectar-pasos]", JSON.stringify(resumen));
  return NextResponse.json(ronda);
}

export async function POST(request: Request) {
  return GET(request);
}
