/**
 * Piloto de re-verificación — 5 hechos sellados de Planta 47 con deadline
 * corrido por el bug de zona horaria del 2026-07-28.
 *
 * Ver docs/marco-limpio/Ficha-Reverificacion-Deadline-Zona.md (§5) y
 * docs/correcciones/2026-07-30-lista-congelada-planta47.md.
 *
 * El cálculo (validación de alcance, deadline corregido, verifyService() con
 * evidencia de telemetry_points) vive en reverificacion-zona-motor.ts —
 * compartido con simular-reverificacion-planta47.ts para que ambos nunca
 * diverjan en CÓMO se calcula el veredicto. Este archivo solo agrega los
 * pasos de ESCRITURA (archivar, sellar, ledger) sobre ese resultado.
 *
 * SIMULACRO POR OMISIÓN. Sin --aplicar no escribe nada: solo recalcula y
 * compara contra el status esperado.
 *
 *   pnpm --filter @jtel/services exec tsx src/reverificar-zona-planta47.ts
 *   pnpm --filter @jtel/services exec tsx src/reverificar-zona-planta47.ts --aplicar
 */
import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { createDb, createRepositories, serviceOccurrences, trips, type Database } from "@jtel/db";
import {
  validarAlcanceYCorregirDeadline,
  reverificarConEvidenciaCorregida,
} from "./reverificacion-zona-motor.js";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      break;
    } catch {
      /* ignore */
    }
  }
}

const MOTIVO_CANONICO =
  "Corrección de deadline por bug de zona horaria del 2026-07-28. Autorizada por " +
  "Asav el 2026-07-30. El veredicto anterior se emitió sobre la ventana de " +
  "evidencia equivocada.";

const AUTORIZADO_POR = "Asav";
const FECHA_AUTORIZACION = "2026-07-30";
const ACTOR_KIND = "human:asav";

type PilotoEntry = {
  occurrenceId: string;
  factIdEsperado: string;
  statusEsperado: "cumplido" | "no_cumplido" | "pendiente_evidencia";
};

// Del §5 de la ficha / lista congelada — exactamente estas 5, ninguna más.
const PILOTO: PilotoEntry[] = [
  {
    occurrenceId: "24ab0a88-778f-4a39-bada-a4434a55b364",
    factIdEsperado: "5c91f9b6-8230-454a-bb78-969b8858411f",
    statusEsperado: "cumplido",
  },
  {
    occurrenceId: "ed3f18e6-cccc-4e31-ae78-03c0a9b17538",
    factIdEsperado: "2dd60106-ecc0-4d6d-a2d0-f637784bf829",
    statusEsperado: "cumplido",
  },
  {
    occurrenceId: "204e29c6-e571-42ef-87e4-547ff340a371",
    factIdEsperado: "342f7e3b-d390-47e0-8dc8-2e86272d3712",
    statusEsperado: "no_cumplido",
  },
  {
    occurrenceId: "ad13fd24-7809-4a20-ae83-4e2cf8735567",
    factIdEsperado: "5c823943-aa7d-4ceb-a9fe-f2e8f60c7b98",
    statusEsperado: "no_cumplido",
  },
  {
    occurrenceId: "4cdfe57b-0998-4e76-b626-d65923fb51eb",
    factIdEsperado: "be8f7aae-4f89-415a-9153-01055d7e55cf",
    statusEsperado: "cumplido",
  },
];

type Resultado = {
  occurrenceId: string;
  guard: "ok" | string;
  statusAnterior?: string;
  statusNuevo?: string;
  statusEsperado?: string;
  coincide?: boolean;
  deadlineAnterior?: string;
  deadlineNuevo?: string;
  factIdNuevo?: string;
  historyId?: string;
};

/**
 * Todo el trabajo de una ocurrencia: valida alcance, recalcula deadline,
 * re-corre verifyService() con evidencia fresca (núcleo compartido). Si
 * `escribir` es true, además archiva el hecho vigente, sella el nuevo y
 * escribe el ledger — y TODO eso pasa con `db` ya siendo una transacción
 * (ver `main`).
 */
async function procesarOcurrencia(
  db: Database,
  entry: PilotoEntry,
  escribir: boolean,
): Promise<Resultado> {
  const repos = createRepositories(db);
  const occ = await repos.occurrences.findById(entry.occurrenceId);
  if (!occ) return { occurrenceId: entry.occurrenceId, guard: "ocurrencia no encontrada" };

  if ((occ.complianceFact?.id ?? null) !== entry.factIdEsperado) {
    return {
      occurrenceId: entry.occurrenceId,
      guard: `fact_id vigente (${occ.complianceFact?.id ?? "ninguno"}) ya no coincide con el esperado (${entry.factIdEsperado}) — no se toca`,
    };
  }

  const guard = await validarAlcanceYCorregirDeadline(db, occ);
  if (!guard.ok) {
    return { occurrenceId: entry.occurrenceId, guard: `${guard.motivo} — no se toca` };
  }
  const { correcto } = guard;
  const statusAnterior = occ.complianceFact?.status ?? "sin_hecho";
  const trip = occ.trip!;

  const { verification, windowStart, windowEnd, memoryPoints, units } =
    await reverificarConEvidenciaCorregida(repos, occ, correcto);

  const finalStatus = verification.status;
  const coincide = finalStatus === entry.statusEsperado;

  const base: Resultado = {
    occurrenceId: entry.occurrenceId,
    guard: "ok",
    statusAnterior,
    statusNuevo: finalStatus,
    statusEsperado: entry.statusEsperado,
    coincide,
    deadlineAnterior: occ.expectedDeadline.toISOString(),
    deadlineNuevo: correcto.toISOString(),
  };

  if (!escribir) return base;

  // Regla dura de §5/§7: si no coincide, no se escribe — se aborta esta
  // ocurrencia (la transacción del caller hace rollback) y se reporta.
  if (!coincide) {
    throw new Error(
      `REGLA DURA: ${entry.occurrenceId} dio "${finalStatus}", la simulación esperaba "${entry.statusEsperado}". ` +
        `No coincide con el mismo camino de código — deteniendo, no se escribió nada de esta ocurrencia.`,
    );
  }

  // 1) Corregir el deadline — guardado por concurrencia: si ya cambió desde
  //    que se leyó, 0 filas y abortamos esta ocurrencia.
  const upd = await db
    .update(serviceOccurrences)
    .set({ expectedDeadline: correcto })
    .where(
      and(
        eq(serviceOccurrences.id, entry.occurrenceId),
        eq(serviceOccurrences.expectedDeadline, occ.expectedDeadline),
      ),
    )
    .returning({ id: serviceOccurrences.id });
  if (upd.length === 0) {
    throw new Error(
      `${entry.occurrenceId}: expected_deadline cambió entre la lectura y la escritura — no se tocó.`,
    );
  }

  // 1b) Dejar la ventana de evidencia del viaje coherente con el deadline ya
  //     corregido (mismo cálculo que ya se usó para leer la evidencia arriba).
  //     Los evidence_points viejos (ventana equivocada) no se borran — no
  //     hacen daño: verifyService ya los excluyó por estar fuera de la
  //     ventana de cobertura, y el guardado nuevo se agrega, no reemplaza.
  await db
    .update(trips)
    .set({ evidenceWindowStart: windowStart, evidenceWindowEnd: windowEnd })
    .where(eq(trips.id, trip.id));

  const resolvedPoints = memoryPoints.map((p) => ({
    imei: p.imei,
    latitude: p.latitude,
    longitude: p.longitude,
    speed: p.speed ?? undefined,
    recordedAt: p.recordedAt,
    deviceId: p.deviceId ?? undefined,
    unitId: p.unitId ?? undefined,
  }));
  if (resolvedPoints.length > 0) {
    await repos.evidence.savePoints(trip.id, resolvedPoints);
  }
  await repos.evidence.updateTripStatus(
    trip.id,
    resolvedPoints.some((p) => p.unitId) ? "disponible" : resolvedPoints.length > 0 ? "parcial" : "indisponible",
  );

  // 2) Archivar el hecho vigente en la historia del sello (no se borra la
  //    fila histórica, solo el hecho vigente — archiveAndDeleteFact hace
  //    ambas cosas en el orden correcto).
  const historyId = await repos.compliance.archiveAndDeleteFact(entry.occurrenceId, ACTOR_KIND, null);

  // 3) Resolver la unidad observada a un UUID real (nunca un IMEI crudo).
  const observedUnitId =
    finalStatus === "cumplido" &&
    verification.observedUnitId &&
    units.some((u) => u.id === verification.observedUnitId)
      ? verification.observedUnitId
      : null;

  // 4) Sellar el hecho nuevo.
  const fact = await repos.compliance.saveFact({
    serviceOccurrenceId: entry.occurrenceId,
    tripId: trip.id,
    expectedDeadline: correcto,
    expectedGeofenceId: occ.expectedGeofenceId,
    referenceUnitId: occ.referenceUnitId,
    observedUnitId,
    observedArrivalAt: finalStatus === "cumplido" ? verification.observedArrivalAt : null,
    observedRouteMatchPct: finalStatus === "cumplido" ? verification.observedRouteMatchPct : null,
    servedVariantId: null,
    status: finalStatus,
    timing: finalStatus === "cumplido" ? verification.timing : null,
    lateExcusable: finalStatus === "cumplido" ? verification.lateExcusable : false,
    routeStrictnessApplied: verification.routeStrictnessApplied,
    contractPolicySnapshot: occ.profile!.contract!.policy,
  });

  await repos.compliance.updateHistorySuccessor(historyId, fact.id);

  // 5) Ledger: motivo canónico y autorización en `metadata`, `action` se
  //    queda en el valor que ya reconoce pairLedgerEntryWithFact
  //    (SEALING_LEDGER_ACTIONS) — si se inventa una acción nueva, la UI de
  //    historia del sello deja de poder emparejar esta entrada con el hecho.
  await repos.compliance.addLedgerEntry({
    tripId: trip.id,
    serviceOccurrenceId: entry.occurrenceId,
    actorKind: ACTOR_KIND,
    actorId: null,
    action: "verificacion_automatica",
    steps: verification.ledgerSteps,
    metadata: {
      motivo: MOTIVO_CANONICO,
      autorizadoPor: AUTORIZADO_POR,
      fechaAutorizacion: FECHA_AUTORIZACION,
      ingestSource: "memory",
      pointCount: memoryPoints.length,
      candidateUnits: verification.candidateUnits,
      referenciaFicha: "docs/marco-limpio/Ficha-Reverificacion-Deadline-Zona.md",
    },
  });

  return { ...base, factIdNuevo: fact.id, historyId };
}

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  const db = createDb(url);

  console.log(`\n${"=".repeat(78)}`);
  console.log(`  RE-VERIFICACIÓN ZONA HORARIA — PILOTO (5) — ${aplicar ? "APLICANDO" : "SIMULACRO (no escribe nada)"}`);
  console.log(`${"=".repeat(78)}\n`);

  const resultados: Resultado[] = [];
  for (const entry of PILOTO) {
    try {
      if (aplicar) {
        const r = await db.transaction(async (tx) => {
          return procesarOcurrencia(tx as unknown as Database, entry, true);
        });
        resultados.push(r);
      } else {
        const r = await procesarOcurrencia(db, entry, false);
        resultados.push(r);
      }
    } catch (err) {
      console.error(`\n✖ ${entry.occurrenceId}: ${err instanceof Error ? err.message : String(err)}\n`);
      if (aplicar) {
        console.error("DETENIENDO — no se procesan las ocurrencias restantes del piloto.\n");
        break;
      }
      resultados.push({ occurrenceId: entry.occurrenceId, guard: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
  }

  console.log("Resultado por ocurrencia:\n");
  for (const r of resultados) {
    if (r.guard !== "ok") {
      console.log(`  ${r.occurrenceId}  SKIP — ${r.guard}`);
      continue;
    }
    const marca = r.coincide ? "✓" : "✖ NO COINCIDE";
    console.log(
      `  ${r.occurrenceId}  ${String(r.statusAnterior).padEnd(20)} → ${String(r.statusNuevo).padEnd(20)} (esperado: ${r.statusEsperado})  ${marca}`,
    );
    console.log(`    deadline  ${r.deadlineAnterior} → ${r.deadlineNuevo}`);
    if (r.factIdNuevo) console.log(`    fact nuevo: ${r.factIdNuevo}  history: ${r.historyId}`);
  }

  const okCount = resultados.filter((r) => r.coincide).length;
  console.log(`\n  coinciden con la simulación: ${okCount}/${PILOTO.length}`);
  if (!aplicar) console.log("\n  SIMULACRO. No se escribió nada. Agrega --aplicar para ejecutar.\n");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
