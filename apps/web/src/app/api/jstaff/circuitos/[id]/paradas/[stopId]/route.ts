import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { avisosAlCorregirSentido, leerSentido, pegarParadaASuSentido } from "@/lib/pegado-de-parada";

/**
 * Mover o renombrar una parada.
 *
 * **No sobrescribe.** El repositorio cierra la versión vigente y abre otra en la
 * misma transacción, así que el pasado no se reescribe y el QR impreso no se
 * toca. Mover una parada no obliga a recalcular ninguna llegada: la llegada se
 * calcula proyectando la unidad sobre el trazado, y la parada no entra en esa
 * cuenta.
 */
export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string; stopId: string }> },
) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id, stopId } = await ctx.params;
  const cuerpo = (await request.json()) as {
    lat?: number;
    lon?: number;
    nombre?: string;
    orden?: number;
    sentido?: "ida" | "vuelta" | null;
    motivo?: string;
    sinPegar?: boolean;
  };

  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });

  // Tipado, sin cast: ver la nota del alta de paradas.
  const cambios: {
    name?: string;
    orden?: number;
    latitude?: number;
    longitude?: number;
    sentido?: "ida" | "vuelta" | null;
    motivo?: string | null;
  } = {};
  if (typeof cuerpo.nombre === "string" && cuerpo.nombre.trim()) cambios.name = cuerpo.nombre.trim();
  if (typeof cuerpo.orden === "number" && Number.isFinite(cuerpo.orden)) cambios.orden = cuerpo.orden;
  /*
   * El sentido que manda: el que llega, o el que la parada YA tiene. Antes era
   * `cuerpo.sentido ?? "ida"`: mover una parada de vuelta sin repetir su
   * sentido la pegaba a la ida (Oasis, 21 sep 2026).
   */
  const actual = (await repos.circuits.listStopsVigentes(id)).find((p) => p.stopId === stopId);
  if (!actual) return NextResponse.json({ error: "Esa parada no tiene versión vigente" }, { status: 404 });
  let sentido = (actual.sentido ?? null) as "ida" | "vuelta" | null;
  if ("sentido" in cuerpo) {
    const leido = leerSentido(cuerpo as Record<string, unknown>);
    if (!leido.ok) return NextResponse.json({ error: "Ese sentido no existe: ida, vuelta o los dos." }, { status: 400 });
    sentido = leido.sentido;
    if (sentido !== actual.sentido) cambios.sentido = sentido;
  }
  if (typeof cuerpo.motivo === "string" && cuerpo.motivo.trim()) cambios.motivo = cuerpo.motivo.trim();

  let avisos: string[] = [];
  const trazados = await repos.circuits.getPaths(id);
  if (Number.isFinite(cuerpo.lat) && Number.isFinite(cuerpo.lon)) {
    // Moverla: se pega al trazado de SU sentido.
    const pegado = pegarParadaASuSentido({
      punto: { lat: cuerpo.lat as number, lon: cuerpo.lon as number },
      sentido,
      trazados,
      toleranciaMetros: circuito.stopSnapToleranceMeters,
      sinPegar: cuerpo.sinPegar,
    });
    if (!pegado.ok) return NextResponse.json({ error: pegado.error }, { status: 400 });
    cambios.latitude = pegado.destino.lat;
    cambios.longitude = pegado.destino.lon;
    avisos = pegado.avisos;
  } else if (cambios.sentido !== undefined) {
    // Sólo el sentido: la parada NO se mueve sola. Si su lugar queda lejos del trazado nuevo, se dice.
    avisos = avisosAlCorregirSentido({
      punto: { lat: actual.latitude, lon: actual.longitude },
      sentido,
      trazados,
      toleranciaMetros: circuito.stopSnapToleranceMeters,
    });
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "No mandaste ningún cambio" }, { status: 400 });
  }

  const nueva = await repos.circuits.reviseStop(stopId, cambios);
  if (!nueva) return NextResponse.json({ error: "Esa parada no tiene versión vigente" }, { status: 404 });

  return NextResponse.json({
    versionId: nueva.id,
    nombre: nueva.name,
    orden: nueva.orden,
    lat: nueva.latitude,
    lon: nueva.longitude,
    sentido: nueva.sentido ?? null,
    desde: nueva.validFrom,
    aviso: avisos.join(" ") || null,
    // Si quedó lejos del trazado de su sentido, la pantalla ofrece moverla.
    lejos: avisos.length > 0 && !(Number.isFinite(cuerpo.lat) && Number.isFinite(cuerpo.lon)),
  });
}

/** Retirar una parada: deja de publicarse, su historia se conserva. */
export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string; stopId: string }> },
) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { stopId } = await ctx.params;
  const url = new URL(request.url);
  const retirada = await getRepos().circuits.retireStop(
    stopId,
    url.searchParams.get("motivo") ?? undefined,
  );
  if (!retirada) return NextResponse.json({ error: "No existe esa parada" }, { status: 404 });
  return NextResponse.json({ stopId: retirada.id, retiradaEn: retirada.retiredAt });
}
