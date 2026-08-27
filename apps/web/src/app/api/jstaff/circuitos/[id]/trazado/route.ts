import { NextResponse } from "next/server";
import { largoDeTrazado } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Guarda el trazado de UN sentido, con la capa que escogió una persona.
 *
 * `capaNombre` se guarda para poder auditar la decisión, nunca para tomarla.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const cuerpo = (await request.json()) as {
    sentido?: string;
    coordenadas?: Array<[number, number]>;
    capaNombre?: string;
    archivoNombre?: string;
  };

  if (cuerpo.sentido !== "ida" && cuerpo.sentido !== "vuelta") {
    return NextResponse.json({ error: "El sentido tiene que ser ida o vuelta" }, { status: 400 });
  }
  const coordenadas = cuerpo.coordenadas ?? [];
  if (coordenadas.length < 2) {
    return NextResponse.json({ error: "Un trazado necesita al menos dos puntos" }, { status: 400 });
  }

  const repos = getRepos();
  if (!(await repos.circuits.getCircuit(id))) {
    return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });
  }

  const guardado = await repos.circuits.upsertPath({
    circuitId: id,
    sentido: cuerpo.sentido,
    coordinates: coordenadas,
    pointCount: coordenadas.length,
    lengthMeters: largoDeTrazado(coordenadas),
    sourceLayerName: cuerpo.capaNombre ?? null,
    sourceFileName: cuerpo.archivoNombre ?? null,
  });

  return NextResponse.json({
    sentido: guardado.sentido,
    puntos: guardado.pointCount,
    largoMetros: Math.round(guardado.lengthMeters),
    capa: guardado.sourceLayerName,
  });
}
