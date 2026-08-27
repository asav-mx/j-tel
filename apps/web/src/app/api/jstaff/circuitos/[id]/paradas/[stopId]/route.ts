import { NextResponse } from "next/server";
import { pegarAlTrazado } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

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
  if (cuerpo.sentido !== undefined) cambios.sentido = cuerpo.sentido;
  if (typeof cuerpo.motivo === "string" && cuerpo.motivo.trim()) cambios.motivo = cuerpo.motivo.trim();

  let aviso: string | null = null;
  if (Number.isFinite(cuerpo.lat) && Number.isFinite(cuerpo.lon)) {
    let destino = { lat: cuerpo.lat as number, lon: cuerpo.lon as number };
    if (!cuerpo.sinPegar) {
      const trazados = await repos.circuits.getPaths(id);
      const trazado = trazados.find((t) => t.sentido === (cuerpo.sentido ?? "ida")) ?? trazados[0];
      if (trazado) {
        const pegado = pegarAlTrazado(destino, trazado.coordinates, circuito.stopSnapToleranceMeters);
        if (pegado) {
          destino = { lat: pegado.proyeccion.lat, lon: pegado.proyeccion.lon };
          aviso = pegado.aviso;
        }
      }
    }
    cambios.latitude = destino.lat;
    cambios.longitude = destino.lon;
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
    desde: nueva.validFrom,
    aviso,
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
