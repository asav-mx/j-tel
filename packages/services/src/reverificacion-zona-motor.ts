/**
 * Núcleo compartido de re-verificación bajo el deadline corregido (bug de
 * zona horaria del 2026-07-28). UN SOLO camino de lectura/cálculo: tanto el
 * piloto de escritura (reverificar-zona-planta47.ts) como el simulador de
 * solo-lectura (simular-reverificacion-planta47.ts) lo importan, para que
 * nunca diverjan en CÓMO se calcula el veredicto — solo en si después
 * escriben o no.
 *
 * Evidencia: se relee de telemetry_points (memoria propia) sobre la ventana
 * YA corregida — nunca evidence_points ya anclada (queda fijada a la ventana
 * vieja) ni el proveedor GPS en vivo. Una sola versión de KML por ruta
 * (getKmlVersionForDate), sin evaluación multi-variante ni pases de
 * exclusividad entre ocurrencias — nada que no pase por verifyService().
 *
 * Ver docs/marco-limpio/Ficha-Reverificacion-Deadline-Zona.md §5.
 */
import { sql } from "drizzle-orm";
import { clasificarDiferencia, type Database, type Repositories } from "@jtel/db";
import { JTTEL_TZ, computeEvidenceWindow, type ContractPolicy, DEFAULT_FRECHET_MAX_KM } from "@jtel/domain";
import { verifyService } from "@jtel/verification";
import { computeExclusiveContentionWindow } from "./verification.js";

export type TurnoPlanta = { startTime: string; plantCode: string | null };

/** Turno y código de planta de una ocurrencia — no viene anidado en occurrences.findById. */
export async function cargarTurnoYPlanta(db: Database, occurrenceId: string): Promise<TurnoPlanta | null> {
  const rows = await db.execute(sql`
    SELECT sh.start_time::text AS start_time, pl.code AS plant_code
      FROM service_occurrences o
      JOIN service_profiles p ON p.id = o.service_profile_id
      JOIN service_contracts ct ON ct.id = p.contract_id
      JOIN route_shifts rs ON rs.id = p.route_shift_id
      JOIN shifts sh ON sh.id = rs.shift_id
      LEFT JOIN plants pl ON pl.id = ct.plant_id
     WHERE o.id = ${occurrenceId}
  `);
  const row = (rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return { startTime: String(row.start_time), plantCode: row.plant_code ? String(row.plant_code) : null };
}

export type OccurrenceWithRelations = NonNullable<
  Awaited<ReturnType<Repositories["occurrences"]["findById"]>>
>;

export type GuardResult =
  | { ok: true; correcto: Date; difMinutos: number }
  | { ok: false; motivo: string };

/**
 * Los tres criterios de §4 de la ficha, revalidados en vivo (no basta con que
 * la fila estuviera en la lista congelada cuando se generó).
 */
export async function validarAlcanceYCorregirDeadline(
  db: Database,
  occ: OccurrenceWithRelations,
): Promise<GuardResult> {
  const turno = await cargarTurnoYPlanta(db, occ.id);
  if (!turno) return { ok: false, motivo: "sin turno/contrato resoluble" };
  if (turno.plantCode !== "47") {
    return { ok: false, motivo: `no pertenece a Planta 47 (code=${turno.plantCode ?? "?"})` };
  }
  const contract = occ.profile?.contract;
  if (!contract) return { ok: false, motivo: "sin contrato" };
  if (!occ.complianceFact) return { ok: false, motivo: "sin hecho sellado" };
  if (!occ.trip) return { ok: false, motivo: "sin viaje" };
  if (!occ.profile?.geofence) return { ok: false, motivo: "sin geocerca" };

  const policy = contract.policy as ContractPolicy;
  const anticipation = policy.arrivalAnticipationMinutes ?? 15;
  const timeZone = policy.timeZone ?? JTTEL_TZ;

  const diff = clasificarDiferencia({
    serviceDate: occ.serviceDate,
    guardado: occ.expectedDeadline,
    shiftStartTime: turno.startTime,
    anticipationMinutes: anticipation,
    timeZone,
  });
  if (diff.causa !== "zona") {
    return { ok: false, motivo: `clasificarDiferencia da "${diff.causa}", no "zona"` };
  }
  return { ok: true, correcto: diff.correcto, difMinutos: diff.difMinutos };
}

/**
 * Re-corre el veredicto con el deadline ya corregido, leyendo evidencia
 * fresca de telemetry_points para la ventana correcta. NO escribe nada.
 */
export async function reverificarConEvidenciaCorregida(
  repos: Repositories,
  occ: OccurrenceWithRelations,
  correcto: Date,
) {
  const contract = occ.profile!.contract!;
  const policy = contract.policy as ContractPolicy;
  const profile = occ.profile!;
  const geofence = profile.geofence!;

  const possibleUnitIds = await repos.profiles.getPossibleUnitIds(profile.id);
  const devices = await repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
  const units = await repos.fleet.getUnitsForCarrier(contract.carrierAccountId);
  const candidateDevices = devices.filter((d) => {
    if (possibleUnitIds.length === 0) return true;
    return units.some(
      (u) => possibleUnitIds.includes(u.id) && d.carrierAccountId === contract.carrierAccountId,
    );
  });
  const imeis = candidateDevices.map((d) => d.imei);

  const { windowStart, windowEnd } = computeEvidenceWindow(correcto, {
    evidenceMarginMinutesBefore: policy.evidenceMarginMinutesBefore ?? 60,
    verificationGraceMinutes: policy.verificationGraceMinutes ?? 15,
    evidenceMarginMinutesAfter: policy.evidenceMarginMinutesAfter ?? 30,
  });

  const memoryPoints = await repos.telemetry.getForImeis(imeis, windowStart, windowEnd);

  const imeiToUnit = new Map<string, string>();
  for (const p of memoryPoints) {
    if (p.unitId) imeiToUnit.set(p.imei, p.unitId);
  }
  for (const p of memoryPoints) {
    if (imeiToUnit.has(p.imei)) continue;
    const device = devices.find((d) => d.imei === p.imei);
    if (!device) continue;
    const asg = await repos.fleet.resolveUnitAtTime(device.id, p.recordedAt);
    if (asg) imeiToUnit.set(p.imei, asg.unitId);
  }

  const routeId = profile.routeShift?.routeId;
  const kml = routeId ? await repos.routes.getKmlVersionForDate(routeId, correcto) : null;

  const cov = computeExclusiveContentionWindow(correcto, policy);
  const verification = verifyService({
    occurrenceId: occ.id,
    expectedDeadline: correcto,
    toleranceMinutes: policy.toleranceMinutes,
    routeStrictness: policy.routeStrictness,
    kmlMatchMinPct: policy.kmlMatchMinPct ?? 60,
    kmlCorridorMeters: policy.kmlCorridorMeters ?? 120,
    kmlCorridorMinPct: policy.kmlCorridorMinPct ?? 60,
    // C12 · sale de la política del contrato, no de un default del motor.
    frechetMaxKm: policy.frechetMaxKm ?? DEFAULT_FRECHET_MAX_KM,
    geofencePolygon: geofence.polygon,
    kmlWaypoints: kml?.waypoints,
    /*
     * C15 · La unidad va en su campo, y el aparato se conserva. Sustituir el
     * imei aquí era lo que hacía que el ledger dijera `imei:` sobre un id de
     * vehículo. La clave de agrupación del motor —`unitId ?? imei`— es la
     * misma que producía la sustitución, así que las candidatas no cambian.
     */
    evidencePoints: memoryPoints.map((p) => ({
      imei: p.imei,
      unitId: imeiToUnit.get(p.imei),
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed ?? undefined,
      timestamp: p.recordedAt,
    })),
    excusableReasons: policy.excusableReasons,
    coverageWindowStart: new Date(cov.startMs),
    coverageWindowEnd: new Date(cov.endMs),
    evidenceMinCoveragePct: policy.evidenceMinCoveragePct ?? 80,
    evidenceMaxGapMinutes: policy.evidenceMaxGapMinutes ?? 10,
  });

  return { verification, windowStart, windowEnd, memoryPoints, devices, units, imeiToUnit, kml };
}
