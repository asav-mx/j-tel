import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { inArray } from "drizzle-orm";
import { instanteZonificado, localDateIso, addDaysIso } from "@jtel/domain";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import {
  accounts,
  circuitUnitAssignments,
  circuits,
  concessionCarriers,
  deviceAssignments,
  devices,
  geofences,
  livePositions,
  plants,
  routeShifts,
  routes,
  serviceContracts,
  serviceOccurrences,
  serviceProfileUnits,
  serviceProfiles,
  shifts,
  telemetryArchiveMarks,
  telemetryPoints,
  trips,
  units,
  userMemberships,
} from "./schema/index.js";

/**
 * El escenario del recorrido y playback (C3-c): lo que la pantalla tiene que
 * enseñar y la calle no produce a voluntad.
 *
 *   pnpm --filter @jtel/db escenario-recorrido             # siembra
 *   pnpm --filter @jtel/db escenario-recorrido --limpiar   # borra
 *
 * Se entra con `JTEL_DEV_USER=escenario_recorrido`, que ve las dos cuentas.
 *
 *   CUENTA escenario-recorrido (contrato de especial + concesión de circuito)
 *   10254  AYER   05:26 sale de la base · hueco 05:38–06:01 · llega a la planta
 *                 06:08 (especial: se corta) con parada · regresa a la base
 *                 14:00–15:30 va al oriente, regresa por la misma calle y sube
 *                 22:00 nocturno a la planta (especial) y regresa cruzando la
 *                 medianoche hasta las 00:40 de HOY
 *          HOY   los últimos 90 min manejando; detenida hace 47 s
 *   10261  con dispositivo que nunca reportó
 *   10301  sin dispositivo, nunca
 *
 *   CUENTA escenario-recorrido-solo (sin contratos ni concesión)
 *   JEEP   un par de horas de ayer — la sección de servicios no existe
 *
 * Los servicios de ayer: «Cliente del escenario · Poniente» 05:30–14:00 y
 * «Cliente del escenario · Nocturno» 22:00–06:00. El circuito del escenario
 * corre de 14:00 a 22:00: hoy ofrece botón; ayer dice que su horario no se
 * guardó. El archivador ya leyó hasta ahora, así que ayer es ventana cerrada.
 *
 * Todo se siembra relativo al momento de sembrar. Vive sólo en la desechable
 * (candado de abajo) y se borra con `--limpiar` (Marco §F).
 */

function archivosDeAmbiente(): string[] {
  const base = ["../../.env", ".env"];
  try {
    const comun = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
    }).trim();
    base.push(join(dirname(comun), ".env"));
  } catch {
    /* fuera de un repo, los dos de arriba tienen que bastar */
  }
  return base;
}

for (const p of archivosDeAmbiente()) {
  if (existsSync(p)) {
    try {
      process.loadEnvFile(p);
      if (process.env.DATABASE_URL_TEST) break;
    } catch {
      /* ignore */
    }
  }
}

const SLUG = "escenario-recorrido";
const ZONA = "America/Ciudad_Juarez";
const id = (n: number) => `f4000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CARRIER = id(1);
const CARRIER_SOLO = id(2);
const CLIENTE = id(3);
const CONCESION = id(4);
const USUARIO = "escenario_recorrido";
const IMEIS = ["FIXTURE-RECORRIDO-001", "FIXTURE-RECORRIDO-002", "FIXTURE-RECORRIDO-003"];

const MIN = 60_000;
type LatLng = [number, number];

const BASE: LatLng[] = [
  [31.699, -106.476],
  [31.699, -106.47],
  [31.703, -106.47],
  [31.703, -106.476],
];
const EN_BASE: LatLng = [31.701, -106.473];
const PLANTA: LatLng[] = [
  [31.74, -106.395],
  [31.74, -106.388],
  [31.745, -106.388],
  [31.745, -106.395],
];
const EN_PLANTA: LatLng = [31.7425, -106.3915];
const CAMINO: LatLng[] = [EN_BASE, [31.715, -106.455], [31.728, -106.43], [31.738, -106.405], [31.7395, -106.3965], EN_PLANTA];

/** Un punto por minuto a lo largo de un camino, repartido por distancia. */
function trayecto(camino: LatLng[], desde: number, minutos: number, velocidad: number) {
  const tramos = camino.slice(1).map((b, i) => Math.hypot(b[0] - camino[i]![0], b[1] - camino[i]![1]));
  const total = tramos.reduce((a, b) => a + b, 0);
  const puntos: Array<{ at: number; lat: number; lng: number; speed: number }> = [];
  for (let m = 0; m <= minutos; m += 1) {
    let falta = (m / minutos) * total;
    let i = 0;
    while (i < tramos.length - 1 && falta > tramos[i]!) falta -= tramos[i++]!;
    const f = tramos[i] ? falta / tramos[i]! : 0;
    const a = camino[i]!;
    const b = camino[i + 1]!;
    puntos.push({ at: desde + m * MIN, lat: a[0] + f * (b[0] - a[0]), lng: a[1] + f * (b[1] - a[1]), speed: velocidad });
  }
  return puntos;
}

function quieto(donde: LatLng, desde: number, minutos: number) {
  return Array.from({ length: minutos + 1 }, (_, m) => ({
    at: desde + m * MIN,
    lat: donde[0] + Math.sin(m) * 0.00001,
    lng: donde[1] + Math.cos(m) * 0.00001,
    speed: 0,
  }));
}

async function limpiar(db: ReturnType<typeof createDb>) {
  await db.delete(livePositions).where(inArray(livePositions.imei, IMEIS));
  await db.delete(telemetryPoints).where(inArray(telemetryPoints.imei, IMEIS));
  await db.delete(accounts).where(inArray(accounts.id, [CARRIER, CARRIER_SOLO, CLIENTE, CONCESION]));
  console.log(`[${SLUG}] borrado.`);
}

async function sembrar(db: ReturnType<typeof createDb>) {
  await limpiar(db);
  const ahora = Date.now();
  const hoy = localDateIso(new Date(ahora), ZONA);
  const ayer = addDaysIso(hoy, -1);
  const a = (hhmm: string, dia = ayer) => {
    const [h, m] = hhmm.split(":").map(Number);
    return instanteZonificado(dia, h! * 60 + m!, ZONA).getTime();
  };

  await db.insert(accounts).values([
    { id: CARRIER, type: "carrier", name: "Escenario recorrido", slug: SLUG },
    { id: CARRIER_SOLO, type: "carrier", name: "Escenario recorrido sin contratos", slug: `${SLUG}-solo` },
    { id: CLIENTE, type: "client", name: "Cliente del escenario", slug: `${SLUG}-cliente` },
    { id: CONCESION, type: "concesion", name: "Concesión del escenario", slug: `${SLUG}-concesion` },
  ]);
  await db.insert(userMemberships).values([
    { accountId: CARRIER, clerkUserId: USUARIO, role: "admin", scopeType: "account" },
    { accountId: CARRIER_SOLO, clerkUserId: USUARIO, role: "admin", scopeType: "account" },
  ]);

  await db.insert(units).values([
    { id: id(101), carrierAccountId: CARRIER, label: "10254" },
    { id: id(102), carrierAccountId: CARRIER, label: "10261" },
    { id: id(103), carrierAccountId: CARRIER, label: "10301" },
    { id: id(151), carrierAccountId: CARRIER_SOLO, label: "JEEP" },
  ]);
  await db.insert(devices).values([
    { id: id(201), carrierAccountId: CARRIER, imei: IMEIS[0]!, label: "TK-REC-001" },
    { id: id(202), carrierAccountId: CARRIER, imei: IMEIS[1]!, label: "TK-REC-002" },
    { id: id(251), carrierAccountId: CARRIER_SOLO, imei: IMEIS[2]!, label: "TK-REC-003" },
  ]);
  const hace30 = new Date(ahora - 30 * 24 * 60 * MIN);
  await db.insert(deviceAssignments).values([
    { unitId: id(101), deviceId: id(201), validFrom: hace30 },
    { unitId: id(102), deviceId: id(202), validFrom: hace30 },
    { unitId: id(151), deviceId: id(251), validFrom: hace30 },
  ]);

  // ── Lugares y servicios especiales ──
  await db.insert(plants).values({ id: id(301), clientAccountId: CLIENTE, name: "Planta del escenario", code: "ESC-REC-P1" });
  const poligono = (p: LatLng[]) => p.map(([lat, lng]) => ({ lat, lng }));
  await db.insert(geofences).values([
    { id: id(302), ownerType: "plant", ownerPlantId: id(301), role: "destino", name: "Planta del escenario", polygon: poligono(PLANTA) },
    { id: id(303), ownerType: "carrier", ownerCarrierAccountId: CARRIER, role: "base", name: "Base", polygon: poligono(BASE) },
  ]);
  await db.insert(serviceContracts).values({
    id: id(304),
    carrierAccountId: CARRIER,
    clientAccountId: CLIENTE,
    plantId: id(301),
    name: "Contrato del escenario",
    status: "active",
    validFrom: "2026-01-01",
    validTo: "2027-12-31",
    policy: {} as never,
  });
  await db.insert(routes).values([
    { id: id(305), clientAccountId: CLIENTE, plantId: id(301), name: "Poniente" },
    { id: id(315), clientAccountId: CLIENTE, plantId: id(301), name: "Nocturno" },
  ]);
  await db.insert(shifts).values([
    { id: id(306), clientAccountId: CLIENTE, plantId: id(301), name: "Primer turno", startTime: "06:00" },
    { id: id(316), clientAccountId: CLIENTE, plantId: id(301), name: "Tercer turno", startTime: "22:30" },
  ]);
  await db.insert(routeShifts).values([
    { id: id(307), clientAccountId: CLIENTE, plantId: id(301), routeId: id(305), shiftId: id(306) },
    { id: id(317), clientAccountId: CLIENTE, plantId: id(301), routeId: id(315), shiftId: id(316) },
  ]);
  await db.insert(serviceProfiles).values([
    { id: id(308), contractId: id(304), routeShiftId: id(307), geofenceId: id(302), name: "Poniente", code: "ESC-REC-1" },
    { id: id(318), contractId: id(304), routeShiftId: id(317), geofenceId: id(302), name: "Nocturno", code: "ESC-REC-2" },
  ]);
  await db.insert(serviceProfileUnits).values([
    { serviceProfileId: id(308), unitId: id(101) },
    { serviceProfileId: id(318), unitId: id(101) },
  ]);
  await db.insert(serviceOccurrences).values([
    { id: id(309), serviceProfileId: id(308), contractId: id(304), routeShiftId: id(307), serviceDate: ayer, expectedDeadline: new Date(a("06:10")), expectedGeofenceId: id(302) },
    { id: id(319), serviceProfileId: id(318), contractId: id(304), routeShiftId: id(317), serviceDate: ayer, expectedDeadline: new Date(a("22:40")), expectedGeofenceId: id(302) },
  ]);
  await db.insert(trips).values([
    { serviceOccurrenceId: id(309), evidenceWindowStart: new Date(a("05:30")), evidenceWindowEnd: new Date(a("14:00")) },
    { serviceOccurrenceId: id(319), evidenceWindowStart: new Date(a("22:00")), evidenceWindowEnd: new Date(a("06:00", hoy)) },
  ]);

  // ── Concesión de circuito ──
  await db.insert(concessionCarriers).values({ concessionAccountId: CONCESION, carrierAccountId: CARRIER, validFrom: hace30 });
  await db.insert(circuits).values({
    id: id(401),
    concessionAccountId: CONCESION,
    name: "Circuito del escenario",
    publicSlug: `${SLUG}-circuito`,
    serviceStartLocal: "14:00",
    serviceEndLocal: "22:00",
  });
  await db.insert(circuitUnitAssignments).values({ circuitId: id(401), unitId: id(101), carrierAccountId: CARRIER, validFrom: hace30 });

  // ── La traza de la 10254 ──
  const deVuelta = [...CAMINO].reverse();
  const traza = [
    ...quieto(EN_BASE, a("05:26"), 4),
    ...trayecto(CAMINO, a("05:31"), 36, 42).filter((p) => p.at <= a("05:38") || p.at >= a("06:01")),
    ...quieto(EN_PLANTA, a("06:08"), 42),
    ...trayecto(deVuelta, a("06:51"), 39, 40),
    ...quieto(EN_BASE, a("07:31"), 14),
    ...trayecto([EN_BASE, [31.701, -106.4]], a("14:00"), 40, 45),
    ...trayecto([[31.701, -106.4], [31.701, -106.44]], a("14:41"), 19, 45).slice(1),
    ...trayecto([[31.701, -106.44], [31.73, -106.44]], a("15:01"), 29, 40).slice(1),
    ...trayecto(CAMINO, a("22:00"), 40, 44),
    ...quieto(EN_PLANTA, a("22:41"), 69),
    ...trayecto(deVuelta, a("23:51"), 49, 38),
  ];
  const inicioHoy = Math.max(ahora - 90 * MIN, a("00:45", hoy));
  const minutosHoy = Math.floor((ahora - 47_000 - inicioHoy) / MIN);
  if (minutosHoy > 5) {
    traza.push(...trayecto([EN_BASE, [31.72, -106.44], [31.735, -106.43]], inicioHoy, minutosHoy, 36));
  }
  const ultimo = { at: ahora - 47_000, lat: 31.735, lng: -106.43, speed: 0 };
  traza.push(ultimo);

  const filas = traza.map((p) => ({
    carrierAccountId: CARRIER,
    imei: IMEIS[0]!,
    deviceId: id(201),
    unitId: id(101),
    latitude: p.lat,
    longitude: p.lng,
    speed: p.speed,
    recordedAt: new Date(p.at),
    source: "traccar",
  }));
  for (let i = 0; i < filas.length; i += 500) await db.insert(telemetryPoints).values(filas.slice(i, i + 500));

  await db.insert(telemetryPoints).values(
    trayecto([EN_BASE, [31.72, -106.46]], a("09:00"), 60, 50).map((p) => ({
      carrierAccountId: CARRIER_SOLO,
      imei: IMEIS[2]!,
      deviceId: id(251),
      unitId: id(151),
      latitude: p.lat,
      longitude: p.lng,
      speed: p.speed,
      recordedAt: new Date(p.at),
      source: "traccar",
    })),
  );

  await db.insert(livePositions).values({
    imei: IMEIS[0]!,
    carrierAccountId: CARRIER,
    deviceId: id(201),
    latitude: ultimo.lat,
    longitude: ultimo.lng,
    speed: 0,
    heading: null,
    recordedAt: new Date(ultimo.at),
    collectedAt: new Date(ultimo.at),
  });
  await db.insert(telemetryArchiveMarks).values(
    IMEIS.map((imei) => ({ carrierAccountId: imei === IMEIS[2] ? CARRIER_SOLO : CARRIER, imei, readUntil: new Date(ahora) })),
  );

  console.log(`[${SLUG}] sembrado a las ${new Date(ahora).toISOString()} · ayer = ${ayer} · ${filas.length} puntos.`);
  console.log(`[${SLUG}] usuario: JTEL_DEV_USER=${USUARIO} · cuentas ${SLUG} y ${SLUG}-solo`);
  console.log(`[${SLUG}] unidad 10254: /casa/transportista/expedientes/unidad/${id(101)}/recorrido?account=${SLUG}`);
}

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");
const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
  confirmacion: iBase >= 0 ? args[iBase + 1] : undefined,
});
if (!veredicto.ok) {
  console.error(`\n  ✗ [${SLUG}] ${veredicto.motivo}\n`);
  process.exit(1);
}
console.log(`[${SLUG}] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}`);

const db = createDb(process.env.DATABASE_URL_TEST!);
if (args.includes("--limpiar")) await limpiar(db);
else await sembrar(db);
process.exit(0);
