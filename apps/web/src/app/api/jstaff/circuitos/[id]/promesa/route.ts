import { NextResponse } from "next/server";
import { explicarRechazoFranja } from "@jtel/domain";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { leerFranjasCapturadas } from "@/lib/promesa-por-franja";

/**
 * Guarda una promesa por franja nueva y COMPLETA (Marco 9.1c).
 *
 * **Las franjas son la única fuente de la promesa** (decisión de Asav, 21 sep
 * 2026): la torre mide contra ellas, y el PR B muda a Ontoy a leerlas también.
 *
 * Reusa `savePromiseTable` tal cual: cierra la versión vigente y abre otra con
 * todas sus franjas, **todo o nada**. Si una sola franja cae fuera del horario
 * de servicio o se encima con otra, no se guarda nada y la respuesta dice cuál
 * y por qué, con el número de renglón para que la pantalla lo marque.
 *
 * Reemplazar una promesa vigente pide motivo: es lo único de la versión
 * cerrada que nadie puede reconstruir después. Y la versión nueva queda firmada
 * con quién la capturó (0049), que sale de la sesión, nunca del formulario.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  // Sin un quién no se escribe una promesa que Ontoy va a decir en voz alta.
  const capturadaPor = g.identidad.userId;
  if (!capturadaPor) return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const cuerpo = (await request.json().catch(() => null)) as { franjas?: unknown; motivo?: unknown } | null;

  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });

  const leidas = leerFranjasCapturadas(cuerpo?.franjas);
  if (!leidas.ok) return NextResponse.json({ error: leidas.error }, { status: 400 });

  const motivo = typeof cuerpo?.motivo === "string" ? cuerpo.motivo.trim().slice(0, 280) : "";
  const vigente = await repos.circuits.getPromiseTableVigente(id);
  if (vigente && !motivo) {
    return NextResponse.json(
      { error: "Ya hay una promesa vigente. Di por qué cambia: queda escrito en la versión que se cierra." },
      { status: 400 },
    );
  }

  const r = await repos.circuits.savePromiseTable(id, leidas.franjas, { motivo, capturadaPor });
  if (!r.ok) {
    return NextResponse.json(
      {
        error: "No se guardó nada: la promesa se guarda completa o no se guarda.",
        rechazadas: r.rechazadas.map((x) => ({
          // `validarFranjas` devuelve la misma franja que recibió: su lugar en la lista es su renglón.
          indice: leidas.franjas.indexOf(x.franja),
          razon: explicarRechazoFranja(x),
        })),
      },
      { status: 422 },
    );
  }

  return NextResponse.json({ ok: true, versionId: r.tableId, franjas: leidas.franjas.length });
}
