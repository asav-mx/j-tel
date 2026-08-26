import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigirCron } from "@/lib/guardia-cron";
import { getUmbrellaConfig } from "@/lib/umbrella-config";
import { CollectorService } from "@jtel/services";

// La invocación cubre una ventana de un minuto haciendo varios sondeos dentro.
// Con cadencia de 30 s son dos, y el segundo arranca en el segundo 30.
export const maxDuration = 90;

export async function GET(request: Request) {
  const negada = exigirCron(request, "cron/collect");
  if (negada) return negada;

  const collector = new CollectorService(getRepos(), getUmbrellaConfig());
  const summary = await collector.collectAll();

  console.log("[cron/collect]", JSON.stringify(summary));

  // 200 mientras UN sondeo haya funcionado: que el de los 30 s falle no vuelve
  // fallida la invocación, porque el de los 0 ya escribió y la app tiene dato.
  // El 503 se reserva para cuando no entró nada: eso sí hay que verlo, y una
  // ruta que siempre contesta 200 sería un canal mudo.
  return NextResponse.json(summary, { status: summary.anyOk ? 200 : 503 });
}

export async function POST(request: Request) {
  return GET(request);
}
