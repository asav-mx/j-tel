import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { pegarAlTrazado } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/** Las paradas vigentes del circuito. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const repos = getRepos();
  return NextResponse.json({ paradas: await repos.circuits.listStopsVigentes(id) });
}

/**
 * Crea una parada donde alguien picó en el mapa.
 *
 * El pegado al trazado se rehace **en el servidor** aunque la pantalla ya lo
 * haya mostrado: lo que dibujó el navegador es una promesa, y lo que se guarda
 * tiene que salir de la misma geometría que después calcula las llegadas.
 * `sinPegar` respeta la decisión de quien editó cuando soltó el pegado a
 * propósito.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const cuerpo = (await request.json()) as {
    lat?: number;
    lon?: number;
    nombre?: string;
    sentido?: "ida" | "vuelta" | null;
    sinPegar?: boolean;
  };

  if (!Number.isFinite(cuerpo.lat) || !Number.isFinite(cuerpo.lon)) {
    return NextResponse.json({ error: "Falta dónde va la parada" }, { status: 400 });
  }

  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });

  const punto = { lat: cuerpo.lat as number, lon: cuerpo.lon as number };
  let destino = punto;
  let aviso: string | null = null;

  if (!cuerpo.sinPegar) {
    const trazados = await repos.circuits.getPaths(id);
    const trazado = trazados.find((t) => t.sentido === (cuerpo.sentido ?? "ida")) ?? trazados[0];
    if (trazado) {
      const pegado = pegarAlTrazado(
        punto,
        trazado.coordinates,
        circuito.stopSnapToleranceMeters,
      );
      if (pegado) {
        destino = { lat: pegado.proyeccion.lat, lon: pegado.proyeccion.lon };
        aviso = pegado.aviso;
      }
    }
  }

  const vigentes = await repos.circuits.listStopsVigentes(id);
  const orden = vigentes.reduce((max, p) => Math.max(max, p.orden), 0) + 1;

  const creada = await repos.circuits.createStop({
    circuitId: id,
    // El QR va impreso en una lámina: se genera una vez y no cambia nunca más,
    // ni cuando la parada se mueva.
    qrSlug: `${circuito.publicSlug}-${randomBytes(4).toString("hex")}`,
    // Arrancan numeradas; el nombre se edita desde la pantalla.
    nombre: cuerpo.nombre?.trim() || `Parada ${orden}`,
    orden,
    latitude: destino.lat,
    longitude: destino.lon,
    sentido: cuerpo.sentido ?? null,
  } as never);

  return NextResponse.json({
    stopId: creada.identidad.id,
    qrSlug: creada.identidad.qrSlug,
    nombre: creada.version.name,
    orden: creada.version.orden,
    lat: creada.version.latitude,
    lon: creada.version.longitude,
    pegada: !cuerpo.sinPegar,
    aviso,
  });
}
