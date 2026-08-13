import { NextResponse } from "next/server";
import { getRepos } from "@/lib/db";
import { exigir } from "@/lib/guardia-api";
import { getIdentidad } from "@/lib/auth";
import type { ContractPolicy } from "@jtel/domain";

/**
 * La versión del transportista sobre un servicio — reconciliación.
 *
 * Escribe SOLO `carrier_aportaciones` y un asiento de bitácora.
 * **Nunca toca `compliance_facts`**, y no por disciplina: ni esta ruta ni el
 * repositorio ni la tabla tienen forma de hacerlo (migración `0022`, con cero
 * llaves foráneas hacia hechos). Si el auditado pudiera cambiar su
 * calificación, J-Telemetry deja de ser árbitro.
 *
 * ---
 *
 * **El catálogo NO vive aquí.** `motivo` se valida contra los
 * `excusableReasons` **de la política del contrato** —hoy 6 en un contrato y 5
 * en el otro—, leídos de la política del SELLO cuando el hecho existe: es con la
 * que se juzgó ese servicio, y ofrecer motivos que entonces no existían sería
 * dejar aportar contra una regla que no aplicaba (C24).
 *
 * Un catálogo propio en esta ruta sería un segundo lugar donde vive la misma
 * lista, y las dos se separarían el primer mes.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    account?: string;
    occurrenceId?: string;
    motivo?: string | null;
    nota?: string | null;
    declaredUnitId?: string | null;
    adjuntos?: Array<{ nombre?: string; url?: string }>;
  } | null;

  const accountSlug = String(body?.account ?? "").trim();
  const occurrenceId = String(body?.occurrenceId ?? "").trim();
  const motivo = body?.motivo ? String(body.motivo).trim() : null;
  const nota = body?.nota ? String(body.nota).trim() : null;
  const declaredUnitId = body?.declaredUnitId ? String(body.declaredUnitId).trim() : null;

  if (!accountSlug || !occurrenceId) {
    return NextResponse.json({ error: "Faltan account u occurrenceId" }, { status: 400 });
  }
  /*
   * Una aportación vacía no aporta. Se exige al menos una de las cuatro cosas
   * que puede traer — si no, se estaría guardando una firma sin contenido, que
   * ensucia el expediente sin decir nada.
   */
  const adjuntosCrudos = Array.isArray(body?.adjuntos) ? body.adjuntos : [];
  if (!motivo && !nota && !declaredUnitId && adjuntosCrudos.length === 0) {
    return NextResponse.json(
      { error: "Aporta al menos un motivo, una nota, una unidad o un adjunto" },
      { status: 400 },
    );
  }

  const g = await exigir(request, { tipo: "carrier", slug: accountSlug }, "json");
  if (!g.ok) return g.respuesta;

  const repos = getRepos();
  const carrier = await repos.accounts.findBySlug(accountSlug);
  if (!carrier || carrier.type !== "carrier") {
    return NextResponse.json({ error: "Carrier no encontrado" }, { status: 404 });
  }

  const occurrence = await repos.occurrences.findById(occurrenceId);
  if (!occurrence?.trip || !occurrence.profile?.contract) {
    return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
  }
  const contract = occurrence.profile.contract;
  if (contract.carrierAccountId !== carrier.id) {
    return NextResponse.json({ error: "No autorizado para este servicio" }, { status: 403 });
  }

  /*
   * La política del SELLO cuando el hecho existe, la viva si todavía no se
   * selló. Es la lección de C24: lo que explica un hecho se lee de con qué se
   * le juzgó, no de lo que rige hoy.
   */
  const fact = occurrence.complianceFact;
  const policy = (fact?.contractPolicySnapshot ?? contract.policy) as ContractPolicy;
  const catalogo = policy?.excusableReasons ?? [];

  if (motivo && !catalogo.includes(motivo as (typeof catalogo)[number])) {
    return NextResponse.json(
      {
        error: "Ese motivo no está en el catálogo del contrato",
        catalogo,
      },
      { status: 400 },
    );
  }

  if (declaredUnitId) {
    const units = await repos.fleet.getUnitsForCarrier(carrier.id);
    if (!units.some((u) => u.id === declaredUnitId)) {
      return NextResponse.json(
        { error: "Esa unidad no es de este transportista" },
        { status: 400 },
      );
    }
  }

  // Referencias, no archivos. Dónde viven los adjuntos es otra decisión.
  const adjuntos = adjuntosCrudos
    .map((a) => ({ nombre: String(a?.nombre ?? "").trim(), url: String(a?.url ?? "").trim() }))
    .filter((a) => a.url.length > 0)
    .slice(0, 10);

  /*
   * La firma. `getIdentidad` puede no traer nombre mientras auth-rbac no esté
   * terminado; se guarda el rol y NUNCA un nombre inventado — una firma falsa
   * es peor que una firma incompleta.
   */
  const identidad = await getIdentidad();
  const fila = await repos.aportaciones.crear({
    serviceOccurrenceId: occurrenceId,
    carrierAccountId: carrier.id,
    motivo,
    nota,
    declaredUnitId,
    adjuntos,
    actorKind: "human",
    actorId: identidad.userId ?? null,
  });

  await repos.compliance.addLedgerEntry({
    tripId: occurrence.trip.id,
    serviceOccurrenceId: occurrenceId,
    actorKind: "human",
    actorId: identidad.userId ?? null,
    action: "aportacion_carrier",
    steps: [
      {
        step: "aportacion_carrier",
        result: "registrada",
        details: {
          aportacionId: fila.id,
          motivo,
          declaredUnitId,
          adjuntos: adjuntos.length,
          // El hecho del cliente no se mueve. Va escrito para que quien lea el
          // asiento no tenga que deducirlo.
          mutatesFact: false,
        },
      },
    ],
    metadata: {
      carrierAccountId: carrier.id,
      carrierSlug: carrier.slug,
      aportacionId: fila.id,
      mutatesFact: false,
    },
  });

  return NextResponse.json({
    ok: true,
    id: fila.id,
    estado: fila.estado,
    // El veredicto no cambia por esta vía, y la respuesta lo dice.
    factUnchanged: true,
  });
}
