import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";

/**
 * Qué unidades corren este circuito, y cuáles se podrían asignar.
 *
 * Las asignaciones vienen completas —vigentes y terminadas—, porque la historia
 * es la mitad del punto: una asignación cerrada con su motivo explica la
 * operación de la concesión meses después.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });

  const [asignaciones, asignables] = await Promise.all([
    repos.circuits.listAssignments(id),
    repos.circuits.listUnidadesAsignables(circuito.concessionAccountId),
  ]);

  return NextResponse.json({ asignaciones, asignables });
}

/**
 * Asigna una unidad al circuito.
 *
 * **El carrier no viene del cuerpo de la petición.** Sale de la unidad, y la
 * unidad tiene que estar en la lista de asignables — que son las unidades
 * activas de los carriers ligados a esta concesión por un `concession_carriers`
 * vigente. Así, una unidad ajena no se puede asignar aunque alguien mande su id:
 * no está en el universo, y no hay filtro que alguien pueda borrar después.
 *
 * Si la unidad venía corriendo otro circuito, el repositorio cierra aquella
 * asignación y abre ésta en la misma transacción. La respuesta dice cuál cerró
 * para que la pantalla lo enuncie en vez de que el cambio ocurra callado.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = await exigir(request, { tipo: "jstaff" }, "json");
  if (!g.ok) return g.respuesta;

  const { id } = await ctx.params;
  const cuerpo = (await request.json()) as { unidadId?: string; motivoDelCierre?: string };
  if (!cuerpo.unidadId) {
    return NextResponse.json({ error: "Falta qué unidad asignar" }, { status: 400 });
  }

  const repos = getRepos();
  const circuito = await repos.circuits.getCircuit(id);
  if (!circuito) return NextResponse.json({ error: "No existe ese circuito" }, { status: 404 });

  const asignables = await repos.circuits.listUnidadesAsignables(circuito.concessionAccountId);
  const unidad = asignables.find((u) => u.unitId === cuerpo.unidadId);
  if (!unidad) {
    return NextResponse.json(
      { error: "Esa unidad no es de un transportista ligado a esta concesión" },
      { status: 400 },
    );
  }

  if (unidad.ocupadaEnCircuitoId === id) {
    return NextResponse.json(
      { error: `${unidad.label} ya corre este circuito` },
      { status: 409 },
    );
  }

  const { abierta, cerrada } = await repos.circuits.assignUnit({
    circuitId: id,
    unitId: unidad.unitId,
    carrierAccountId: unidad.carrierAccountId,
    motivoDelCierre: cuerpo.motivoDelCierre?.trim() || `Reasignada a ${circuito.name}`,
  });

  return NextResponse.json({
    asignacionId: abierta.id,
    unidad: unidad.label,
    desde: abierta.validFrom,
    // Null cuando la unidad estaba libre. Cuando no, la pantalla ya lo había
    // avisado antes de confirmar; esto es la constancia de que ocurrió.
    cerro: cerrada
      ? { asignacionId: cerrada.id, circuitoId: cerrada.circuitId, hasta: cerrada.validTo }
      : null,
  });
}
