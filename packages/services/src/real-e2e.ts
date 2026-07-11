/**
 * Prueba real de punta a punta del motor de verificación.
 *
 * Toma un dispositivo GPS REAL de la cuenta de Umbrella, arma en la base la
 * cadena operativa completa (cliente -> planta -> geocerca destino -> contrato
 * -> perfil -> ocurrencia -> viaje) apuntando a la ubicación real del equipo,
 * y corre la MISMA lógica de ingesta + verificación que usa el cron. Produce
 * dos veredictos reales sobre el mismo track:
 *   - uno "a tiempo"  -> debe salir CUMPLIDO
 *   - uno "con retraso"-> debe salir NO_CUMPLIDO
 *
 * Todo lo que crea queda claramente etiquetado como "PRUEBA REAL" para poder
 * identificarlo (o borrarlo) fácilmente después.
 *
 * Ejecutar:  pnpm --filter @jtel/services run real-e2e
 */
import { existsSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import {
  accounts,
  complianceFacts,
  createDb,
  createRepositories,
  geofences,
  ledgerEntries,
  evidencePoints,
  plants,
  serviceContracts,
  serviceOccurrences,
  serviceProfiles,
  trips,
} from "@jtel/db";
import { createUmbrellaProvider } from "@jtel/gps-umbrella";
import { verifyService, pointInPolygon } from "@jtel/verification";
import type { ContractPolicy } from "@jtel/domain";

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

const POLICY: ContractPolicy = {
  toleranceMinutes: 10,
  arrivalAnticipationMinutes: 15,
  verificationGraceMinutes: 15,
  routeStrictness: "destino_only",
  kmlMatchMinPct: 60,
  allowAlternateDestination: false,
  excusableReasons: [],
  enforcementRules: [{ type: "no_pago_viaje", toleranceMinutes: 10 }],
  evidenceMarginMinutesBefore: 60,
  evidenceMarginMinutesAfter: 30,
  maxRouteDurationMinutes: 60,
  evidenceMinCoveragePct: 80,
  evidenceMaxGapMinutes: 10,
};

function normalizeUmbrellaBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /\/openapi$/i.test(trimmed) ? trimmed : `${trimmed}/openapi`;
}

function box(lat: number, lng: number, half = 0.003) {
  return [
    { lat: lat - half, lng: lng - half },
    { lat: lat + half, lng: lng - half },
    { lat: lat + half, lng: lng + half },
    { lat: lat - half, lng: lng + half },
  ];
}

function fmt(d: Date | null | undefined) {
  return d ? d.toISOString().replace("T", " ").slice(0, 19) + "Z" : "—";
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("Falta DATABASE_URL en .env");

  const baseUrl = normalizeUmbrellaBaseUrl(
    process.env.UMBRELLA_GPS_URL ??
      process.env.UMBRELLA_GPS_BASE_URL ??
      "http://gps2.umbrellasoluciones.com/openapi",
  );
  const userId = process.env.UMBRELLA_GPS_USERID ?? "";
  const password = process.env.UMBRELLA_GPS_PASSWORD ?? "";
  if (!userId || !password) {
    throw new Error("Faltan UMBRELLA_GPS_USERID / UMBRELLA_GPS_PASSWORD en .env");
  }

  const db = createDb(dbUrl);
  const repos = createRepositories(db);
  const provider = createUmbrellaProvider({
    baseUrl,
    credentials: { userId, password },
  });

  // Borra en orden todo lo colgado de un cliente (algunas FK no tienen cascade).
  async function cleanupClient(clientId: string) {
    const cts = await db
      .select({ id: serviceContracts.id })
      .from(serviceContracts)
      .where(eq(serviceContracts.clientAccountId, clientId));
    const ctIds = cts.map((c) => c.id);

    if (ctIds.length > 0) {
      const occ = await db
        .select({ id: serviceOccurrences.id })
        .from(serviceOccurrences)
        .where(inArray(serviceOccurrences.contractId, ctIds));
      const occIds = occ.map((o) => o.id);

      if (occIds.length > 0) {
        const tr = await db
          .select({ id: trips.id })
          .from(trips)
          .where(inArray(trips.serviceOccurrenceId, occIds));
        const trIds = tr.map((t) => t.id);

        await db.delete(complianceFacts).where(inArray(complianceFacts.serviceOccurrenceId, occIds));
        if (trIds.length > 0) {
          await db.delete(ledgerEntries).where(inArray(ledgerEntries.tripId, trIds));
          await db.delete(evidencePoints).where(inArray(evidencePoints.tripId, trIds));
          await db.delete(trips).where(inArray(trips.id, trIds));
        }
        await db.delete(serviceOccurrences).where(inArray(serviceOccurrences.id, occIds));
      }
      await db.delete(serviceProfiles).where(inArray(serviceProfiles.contractId, ctIds));
      await db.delete(serviceContracts).where(inArray(serviceContracts.id, ctIds));
    }

    const pl = await db
      .select({ id: plants.id })
      .from(plants)
      .where(eq(plants.clientAccountId, clientId));
    const plIds = pl.map((p) => p.id);
    if (plIds.length > 0) {
      await db.delete(geofences).where(inArray(geofences.ownerPlantId, plIds));
      await db.delete(plants).where(inArray(plants.id, plIds));
    }

    await db.delete(accounts).where(eq(accounts.id, clientId));
  }

  // 1) Conectar a Umbrella y encontrar un equipo con dato reciente ------------
  console.log(`\n[1/6] Conectando a Umbrella (${baseUrl}) como ${userId}...`);
  const token = await provider.login();
  console.log("      Token OK.");

  const last = await provider.getLastLocations(token);
  console.log(`      Umbrella reporta ${last.length} ubicaciones actuales.`);
  if (last.length === 0) {
    throw new Error(
      "Umbrella no devolvió ubicaciones. ¿La cuenta tiene equipos con GPS activo?",
    );
  }

  const chosen = [...last].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )[0]!;
  console.log(
    `      Equipo elegido: IMEI ${chosen.imei} | último dato ${fmt(chosen.timestamp)} | (${chosen.latitude}, ${chosen.longitude})`,
  );

  // 2) Traer su track real de las últimas horas -------------------------------
  const windowEnd = new Date(chosen.timestamp.getTime() + 10 * 60 * 1000);
  const windowStart = new Date(chosen.timestamp.getTime() - 6 * 60 * 60 * 1000);
  console.log(
    `\n[2/6] Descargando historial real ${fmt(windowStart)} → ${fmt(windowEnd)}...`,
  );
  const history = await provider.getHistoryLocations(token, {
    imeis: [chosen.imei],
    beginGmt: windowStart,
    endGmt: windowEnd,
  });
  console.log(`      Puntos de historial: ${history.length}`);

  const track = history.length > 0 ? history : [chosen];
  const arrivalPoint = track[track.length - 1]!;
  const geofence = box(arrivalPoint.latitude, arrivalPoint.longitude);

  const enterPoint = track.find((p) =>
    pointInPolygon({ lat: p.latitude, lng: p.longitude }, geofence),
  );
  const enterTime = (enterPoint ?? arrivalPoint).timestamp;
  console.log(
    `      Geocerca de destino centrada en el último punto. Entrada real detectada: ${fmt(enterTime)}`,
  );

  const tripWindowStart = new Date(track[0]!.timestamp.getTime() - 5 * 60 * 1000);
  const tripWindowEnd = new Date(arrivalPoint.timestamp.getTime() + 5 * 60 * 1000);

  // 3) Carrier + unidad + dispositivo -----------------------------------------
  console.log(`\n[3/6] Preparando carrier / unidad / GPS...`);
  const carrier = await repos.accounts.findBySlug("juarez-bus");
  if (!carrier) throw new Error("No existe el carrier 'juarez-bus' en la base.");

  const carrierDevices = await repos.fleet.getDevicesForCarrier(carrier.id);
  let device = carrierDevices.find((d) => d.imei === chosen.imei) ?? null;
  if (!device) {
    device = await repos.fleet.createDevice(
      carrier.id,
      chosen.imei,
      `PRUEBA REAL ${chosen.imei.slice(-4)}`,
    );
    console.log(`      GPS ${chosen.imei} registrado en el carrier.`);
  } else {
    console.log(`      GPS ${chosen.imei} ya estaba registrado en el carrier.`);
  }

  let assignment = await repos.fleet.resolveUnitAtTime(device.id, enterTime);
  if (!assignment) {
    const unit = await repos.fleet.createUnit(
      carrier.id,
      `PRUEBA REAL – Unidad ${chosen.imei.slice(-4)}`,
    );
    assignment = await repos.fleet.assignDevice(
      unit.id,
      device.id,
      new Date(tripWindowStart.getTime() - 24 * 60 * 60 * 1000),
    );
    console.log(`      Unidad de prueba creada y GPS asignado.`);
  } else {
    console.log(`      El GPS ya está asignado a una unidad existente.`);
  }
  const unitId = assignment.unitId;

  // 4) Cliente + planta + geocerca --------------------------------------------
  console.log(`\n[4/6] Preparando cliente / planta / geocerca destino...`);
  // Limpia la prueba anterior para no acumular datos (cascade borra plantas,
  // geocercas, contrato, perfiles, ocurrencias, viajes y hechos).
  const previous = await repos.accounts.findBySlug("prueba-real");
  if (previous) {
    await cleanupClient(previous.id);
    console.log("      Prueba anterior eliminada.");
  }
  const client = await repos.accounts.create({
    type: "client",
    name: "PRUEBA REAL",
    slug: "prueba-real",
  });
  await repos.clients.createProfile(client.id, "Cliente de Prueba Real");
  console.log("      Cliente 'PRUEBA REAL' creado.");

  const plant = await repos.clients.createPlant({
    clientAccountId: client.id,
    name: `Destino Prueba ${fmt(enterTime).slice(0, 10)}`,
    code: `PR-${Date.now().toString().slice(-6)}`,
  });

  const destino = await repos.geofences.create({
    ownerType: "plant",
    ownerPlantId: plant.id,
    role: "destino",
    name: "Destino real (ubicación GPS)",
    polygon: geofence,
  });

  const route = await repos.routes.createRoute({
    clientAccountId: client.id,
    plantId: plant.id,
    name: "Ruta Prueba Real",
  });
  const shift = await repos.routes.createShift({
    clientAccountId: client.id,
    plantId: plant.id,
    name: "Turno Prueba",
    startTime: "07:00:00",
  });
  const routeShift = await repos.routes.createRouteShift({
    clientAccountId: client.id,
    plantId: plant.id,
    routeId: route.id,
    shiftId: shift.id,
  });

  const contract = await repos.contracts.create({
    carrierAccountId: carrier.id,
    clientAccountId: client.id,
    plantId: plant.id,
    name: "Contrato PRUEBA REAL",
    validFrom: new Date().toISOString().split("T")[0]!,
    validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]!,
    policy: POLICY,
    status: "active",
  });

  // 5) Dos perfiles + ocurrencias + viajes (mismo track, distinto deadline) ---
  console.log(`\n[5/6] Creando 2 escenarios sobre el MISMO track real...`);
  const deadlineOnTime = new Date(enterTime.getTime() + 20 * 60 * 1000); // llega antes
  const deadlineLate = new Date(enterTime.getTime() - 30 * 60 * 1000); // llega 30 min tarde

  async function makeScenario(
    label: string,
    deadline: Date,
    serviceDate: string,
  ) {
    const profile = await repos.profiles.create({
      contractId: contract.id,
      routeShiftId: routeShift.id,
      geofenceId: destino.id,
      name: label,
      possibleUnitIds: [unitId],
      referenceUnitId: unitId,
      activeDays: [0, 1, 2, 3, 4, 5, 6],
    });

    const [occurrence] = await db
      .insert(serviceOccurrences)
      .values({
        serviceProfileId: profile.id,
        contractId: contract.id,
        routeShiftId: routeShift.id,
        serviceDate,
        expectedDeadline: deadline,
        expectedGeofenceId: destino.id,
        referenceUnitId: unitId,
      })
      .returning();

    await db.insert(trips).values({
      serviceOccurrenceId: occurrence!.id,
      evidenceWindowStart: tripWindowStart,
      evidenceWindowEnd: tripWindowEnd,
      evidenceStatus: "en_espera",
    });

    return occurrence!.id;
  }

  const dateStr = fmt(enterTime).slice(0, 10);
  const occOnTime = await makeScenario(
    "Escenario A — llegada a tiempo",
    deadlineOnTime,
    dateStr,
  );
  const occLate = await makeScenario(
    "Escenario B — llegada con retraso",
    deadlineLate,
    dateStr,
  );

  // 6) Correr verificación real (motor de reglas sobre el track GPS real) -----
  console.log(`\n[6/6] Verificando contra el GPS real...`);

  // Reutilizamos el track real ya descargado en el paso 2 (misma función que
  // usa el cron, provider.getHistoryLocations) para no volver a pegarle a
  // Umbrella y respetar su cuota de 1 req/seg.
  const sharedPoints = track.map((p) => ({
    imei: p.imei,
    latitude: p.latitude,
    longitude: p.longitude,
    speed: p.speed,
    recordedAt: p.timestamp,
    deviceId: device.id,
    unitId,
  }));

  async function verify(occId: string) {
    const occ = await repos.occurrences.findById(occId);
    const trip = occ!.trip!;

    await repos.evidence.savePoints(trip.id, sharedPoints);
    await repos.evidence.updateTripStatus(trip.id, "disponible");

    const points = (await repos.evidence.getPointsForTrip(trip.id)).map((p) => ({
      imei: p.imei,
      latitude: p.latitude,
      longitude: p.longitude,
      speed: p.speed ?? undefined,
      timestamp: p.recordedAt,
    }));

    const result = verifyService({
      occurrenceId: occId,
      expectedDeadline: occ!.expectedDeadline,
      toleranceMinutes: POLICY.toleranceMinutes,
      routeStrictness: POLICY.routeStrictness,
      geofencePolygon: geofence,
      evidencePoints: points,
      excusableReasons: POLICY.excusableReasons,
    });

    await repos.compliance.saveFact({
      serviceOccurrenceId: occId,
      tripId: trip.id,
      expectedDeadline: occ!.expectedDeadline,
      expectedGeofenceId: occ!.expectedGeofenceId,
      referenceUnitId: occ!.referenceUnitId,
      observedUnitId: unitId,
      observedArrivalAt: result.observedArrivalAt,
      observedRouteMatchPct: result.observedRouteMatchPct,
      status: result.status,
      timing: result.timing,
      lateExcusable: result.lateExcusable,
      routeStrictnessApplied: result.routeStrictnessApplied,
      contractPolicySnapshot: POLICY,
    });

    await repos.compliance.addLedgerEntry({
      tripId: trip.id,
      serviceOccurrenceId: occId,
      action: "verificacion_prueba_real",
      steps: result.ledgerSteps,
      metadata: { pointCount: points.length },
    });

    return {
      deadline: occ!.expectedDeadline,
      pointCount: points.length,
      status: result.status,
      timing: result.timing,
      arrival: result.observedArrivalAt,
    };
  }

  const a = await verify(occOnTime);
  const b = await verify(occLate);

  console.log("\n========== RESULTADO DE LA PRUEBA REAL ==========");
  console.log(`IMEI real verificado : ${chosen.imei}`);
  console.log(`Puntos GPS reales    : ${a.pointCount}`);
  console.log(`Llegada real (geocerca): ${fmt(a.arrival)}`);
  console.log("");
  console.log(`Escenario A (a tiempo)  | deadline ${fmt(a.deadline)} | timing=${a.timing} | => ${a.status.toUpperCase()}`);
  console.log(`Escenario B (retraso)   | deadline ${fmt(b.deadline)} | timing=${b.timing} | => ${b.status.toUpperCase()}`);
  console.log("=================================================");
  console.log(
    "\nAbre en la app:  /cliente?account=prueba-real   (y el panel del carrier juarez-bus)\n",
  );

  process.exit(0);
}

main().catch((err) => {
  console.error("\nERROR en la prueba real:", err);
  process.exit(1);
});
