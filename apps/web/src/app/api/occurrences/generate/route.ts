import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { esFechaCivil } from "@jtel/domain";

export async function POST(request: Request) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const body = await request.json();
  const { profileId, fromDate, toDate } = body as {
    profileId: string;
    fromDate: string;
    toDate: string;
  };

  if (!profileId || !fromDate || !toDate) {
    return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
  }

  /* El rango son fechas civiles `YYYY-MM-DD`: el generador ya no recibe
     instantes, para que nadie tenga que elegir en qué zona leerlos (arreglo
     del 23-sep-2026). `new Date(fromDate)` admitía además cualquier cosa que
     el parser de JS aceptara, y `Invalid Date` entraba sin protestar. */
  if (!esFechaCivil(fromDate) || !esFechaCivil(toDate)) {
    return NextResponse.json({ error: "Las fechas van como AAAA-MM-DD" }, { status: 400 });
  }

  const repos = getRepos();
  const result = await repos.occurrences.generateForProfile(profileId, fromDate, toDate, {
    rollingDays: 30,
  });

  return NextResponse.json({
    created: result.createdIds.length,
    ids: result.createdIds,
    skippedExisting: result.skippedExisting,
    clamped: result.clamped,
  });
}
