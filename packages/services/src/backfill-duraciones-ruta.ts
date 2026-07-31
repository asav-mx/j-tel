/**
 * Arranque de la historia de duraciones: mide cuánto duró de verdad cada
 * recorrido pasado usando la telemetría que ya está guardada, y lo escribe en
 * `route_traversal_measurements`.
 *
 * Sin esto, la ventana derivada empieza sin historia y se dimensiona solo con
 * la geometría del trazado — que subestima justo las rutas que pasan mucho
 * tiempo detenidas sobre el corredor (25–35 km en 200+ minutos). Con esto, el
 * motor arranca sabiendo cuánto dura cada ruta desde el primer día.
 *
 * **Búsqueda AMPLIA a propósito.** No se usa la ventana configurada del viaje
 * sino un rango generoso alrededor del deadline: la ventana angosta es
 * justamente el defecto que se está corrigiendo, y medir dentro de ella
 * devolvería la duración recortada. Por eso estas mediciones NO se marcan como
 * cota inferior.
 *
 * NO toca hechos, ni veredictos, ni la política. Solo escribe mediciones.
 *
 *   pnpm --filter @jtel/services exec tsx src/backfill-duraciones-ruta.ts [--dias=120]
 */
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { createDb, createRepositories, type Database, type Repositories } from "@jtel/db";
import { measureBestTraversal, corridorKmFromMeters } from "./medicion-recorrido.js";
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

/** Horas antes/después del deadline en las que se busca telemetría. */
const BUSQUEDA_HORAS_ANTES = 6;
const BUSQUEDA_HORAS_DESPUES = 3;

type Fila = {
  occurrenceId: string;
  serviceDate: string;
  expectedDeadline: Date;
  routeId: string;
  routeShiftId: string;
  ruta: string;
  turno: string;
};

async function cargarOcurrencias(db: Database, dias: number): Promise<Fila[]> {
  const rows = await db.execute(sql`
    SELECT o.id AS occurrence_id, o.service_date::text AS service_date, o.expected_deadline,
           r.id AS route_id, rs.id AS route_shift_id, r.name AS ruta, sh.name AS turno
      FROM service_occurrences o
      JOIN service_profiles p ON p.id = o.service_profile_id
      JOIN route_shifts rs ON rs.id = p.route_shift_id
      JOIN routes r ON r.id = rs.route_id
      JOIN shifts sh ON sh.id = rs.shift_id
      JOIN trips t ON t.service_occurrence_id = o.id
     WHERE o.service_date >= (CURRENT_DATE - ${dias}::int)
       AND o.expected_deadline < NOW()
       AND NOT EXISTS (
         SELECT 1 FROM route_traversal_measurements m
          WHERE m.service_occurrence_id = o.id
       )
     ORDER BY o.service_date DESC
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    occurrenceId: String(r.occurrence_id),
    serviceDate: String(r.service_date),
    expectedDeadline: new Date(r.expected_deadline as string),
    routeId: String(r.route_id),
    routeShiftId: String(r.route_shift_id),
    ruta: String(r.ruta),
    turno: String(r.turno),
  }));
}

async function medirYGuardar(repos: Repositories, fila: Fila): Promise<number | null> {
  const occ = await repos.occurrences.findById(fila.occurrenceId);
  if (!occ?.profile?.contract) return null;

  const kml = await repos.routes.getKmlVersionForDate(fila.routeId, fila.expectedDeadline);
  if (!kml?.waypoints?.length) return null;

  const policy = occ.profile.contract.policy as ContractPolicy;
  const devices = await repos.fleet.getDevicesForCarrier(
    occ.profile.contract.carrierAccountId,
  );
  const imeis = devices.map((d) => d.imei);
  if (imeis.length === 0) return null;

  const desde = new Date(
    fila.expectedDeadline.getTime() - BUSQUEDA_HORAS_ANTES * 3_600_000,
  );
  const hasta = new Date(
    fila.expectedDeadline.getTime() + BUSQUEDA_HORAS_DESPUES * 3_600_000,
  );
  const puntos = await repos.telemetry.getForImeis(imeis, desde, hasta);
  if (puntos.length === 0) return null;

  const medido = measureBestTraversal(
    puntos.map((p) => ({
      imei: p.imei,
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.recordedAt,
    })),
    kml.waypoints,
    corridorKmFromMeters(policy.kmlCorridorMeters),
    // Sin `window`: la búsqueda amplia es el punto de este script, y su
    // resultado no está recortado por la ventana del viaje.
  );
  if (medido?.measurement.durationMinutes == null) return null;

  await repos.routeTraversals.record({
    routeShiftId: fila.routeShiftId,
    serviceOccurrenceId: fila.occurrenceId,
    serviceDate: fila.serviceDate,
    kmlVersionId: kml.id,
    durationMinutes: medido.measurement.durationMinutes,
    lowerBound: false,
    pointsInCorridor: medido.measurement.pointsInCorridor,
    unitId: null,
  });

  return medido.measurement.durationMinutes;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  const diasArg = process.argv.find((a) => a.startsWith("--dias="));
  const dias = Math.max(1, Number(diasArg?.split("=")[1] ?? 120));

  const db = createDb(url);
  const repos = createRepositories(db);

  console.log(`\n  Midiendo duraciones reales de los últimos ${dias} días...\n`);

  const filas = await cargarOcurrencias(db, dias);
  console.log(`  ${filas.length} ocurrencias sin medición.\n`);

  const porRuta = new Map<string, { ruta: string; turno: string; duraciones: number[] }>();
  let medidas = 0;

  for (const [i, fila] of filas.entries()) {
    try {
      const duracion = await medirYGuardar(repos, fila);
      if (duracion == null) continue;
      medidas++;
      const clave = fila.routeShiftId;
      const acc = porRuta.get(clave) ?? {
        ruta: fila.ruta,
        turno: fila.turno,
        duraciones: [],
      };
      acc.duraciones.push(duracion);
      porRuta.set(clave, acc);
    } catch (err) {
      console.error(
        `  ✖ ${fila.occurrenceId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${filas.length}...`);
  }

  console.log(`\n  ${medidas} mediciones guardadas, ${porRuta.size} rutas×turno con historia.\n`);
  console.log("  Ruta | Turno | muestras | mediana (min) | máx (min)");
  for (const { ruta, turno, duraciones } of porRuta.values()) {
    const ordenadas = [...duraciones].sort((a, b) => a - b);
    const mediana = ordenadas[Math.floor(ordenadas.length / 2)]!;
    const max = ordenadas[ordenadas.length - 1]!;
    console.log(
      `  ${ruta} | ${turno} | ${duraciones.length} | ${mediana.toFixed(0)} | ${max.toFixed(0)}`,
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
