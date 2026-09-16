import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import {
  accounts,
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
  telemetryPoints,
  trips,
  units,
} from "./schema/index.js";

/**
 * El escenario de la flota de Compás: una unidad y un dispositivo en cada estado.
 *
 *   pnpm --filter @jtel/db escenario-flota-compas             # siembra
 *   pnpm --filter @jtel/db escenario-flota-compas --limpiar   # borra
 *
 * Y para comprobar que la clasificación ve lo que se sembró, por las consultas
 * de verdad:
 *
 *   pnpm --filter @jtel/services escenario-flota-compas-revisar
 *
 * ## Por qué un escenario
 *
 * La flota real no tiene hoy un dispositivo en cada estado —los ocho de la
 * cuenta ASAV están apagados, y nadie tiene uno en bodega que haya reportado—, y
 * los estados no se agendan: un dispositivo desconectado tarda un día en
 * serlo. Las posiciones se siembran **relativas al momento de sembrar**, así que
 * las edades valen para ese momento: se re-siembra antes de mirar.
 *
 * Vive sólo en la rama desechable (candado de abajo), lo mira quien lo sembró y
 * se borra con `--limpiar`: no le produce a nadie una afirmación que el sistema
 * no midió (Marco §F).
 *
 * ## Lo que siembra
 *
 *   UNIDADES
 *   10254  en línea, en movimiento   42.7 km/h, rumbo 135, hace 14 s
 *   10261  en línea, detenida        0.8 km/h, hace 2.1 min
 *   10299  en línea, sin velocidad   el archivo (hace 5 min) llegó más lejos que la viva (hace 2 h)
 *   10288  sin señal                 hace 3.8 h
 *   10295  sin señal                 montada hace 2 h, todavía no reporta
 *   10290  desconectado              última señal hace 3 días
 *   10301  sin dispositivo
 *   10320  sin dispositivo           su único dispositivo está de baja pero sigue montado (anomalía)
 *   10310  inactiva                  no entra a la flota; se cuenta
 *   6284   en destino                turno especial vigente; llegó a la planta hace 33 min
 *   9385   en línea                  adentro de la MISMA planta, sin servicio especial: de paso
 *
 *   DISPOSITIVOS (además de los montados de arriba)
 *   TK-ESC-007  en bodega            última señal hace 5 días
 *   TK-ESC-008  en bodega            nunca reportó
 *   TK-ESC-009  de baja              con fecha y motivo, ya soltado
 *   TK-ESC-010  de baja              sin soltar de 10320 (la anomalía de arriba)
 *
 *   LUGARES Y SERVICIO (para EN DESTINO, C2)
 *   Un cliente del escenario con su planta y su geocerca de destino, un contrato
 *   activo con un perfil que tiene a la 6284 como unidad posible, y una
 *   ocurrencia cuya ventana de evidencia va de hace 70 min a dentro de 50: el
 *   servicio especial vigente del Marco 7.7. La base del carrier también se
 *   siembra, para verla en el mapa sin que corte nada.
 *
 * La 6284 y la 9385 están en la misma geocerca a propósito: es la Pieza 7 en
 * pantalla. Una da un servicio especial y está EN DESTINO; la otra no, y sigue
 * EN LÍNEA.
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

/** Ids fijos: es lo que hace la siembra repetible en vez de acumulativa. */
const SLUG = "escenario-flota-compas";
const CARRIER = "f3000000-0000-4000-8000-000000000001";

const CLIENTE = "f3000000-0000-4000-8000-000000000002";
const id = (n: number) => `f3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const imei = (n: number) => `FIXTURE-FLOTA-${String(n).padStart(3, "0")}`;

const MIN = 60_000;
const HORA = 60 * MIN;

/** La geocerca de destino del escenario, al oriente de Juárez. */
const PLANTA_POLIGONO = [
  { lat: 31.7400, lng: -106.3950 },
  { lat: 31.7400, lng: -106.3880 },
  { lat: 31.7450, lng: -106.3880 },
  { lat: 31.7450, lng: -106.3950 },
];
const PLANTA_ADENTRO: [number, number] = [31.7418, -106.3925];
const DIA = 24 * HORA;

async function limpiar(db: ReturnType<typeof createDb>) {
  const imeis = Array.from({ length: 12 }, (_, i) => imei(i + 1));
  // `live_positions` y `telemetry_points` no cuelgan del carrier por IMEI: se
  // borran por su IMEI de fixture antes de soltar la cuenta.
  await db.delete(livePositions).where(inArray(livePositions.imei, imeis));
  await db.delete(telemetryPoints).where(inArray(telemetryPoints.imei, imeis));
  // Unidades, dispositivos, asignaciones, planta, geocercas, contrato, perfil,
  // ocurrencia y viaje caen en cascada con las dos cuentas, en una sola sentencia.
  await db.delete(accounts).where(inArray(accounts.id, [CARRIER, CLIENTE]));
  console.log(`[${SLUG}] borrado.`);
}

async function sembrar(db: ReturnType<typeof createDb>) {
  await limpiar(db);
  const ahora = Date.now();
  const hace = (ms: number) => new Date(ahora - ms);

  await db.insert(accounts).values({ id: CARRIER, type: "carrier", name: "Escenario flota Compás", slug: SLUG });

  const unidades = [
    { n: 101, label: "10254", active: true },
    { n: 102, label: "10261", active: true },
    { n: 103, label: "10299", active: true },
    { n: 104, label: "10288", active: true },
    { n: 105, label: "10295", active: true },
    { n: 106, label: "10290", active: true },
    { n: 107, label: "10301", active: true },
    { n: 108, label: "10320", active: true },
    { n: 109, label: "10310", active: false },
    { n: 110, label: "6284", active: true },
    { n: 111, label: "9385", active: true },
  ];
  await db.insert(units).values(
    unidades.map((u) => ({ id: id(u.n), carrierAccountId: CARRIER, label: u.label, active: u.active })),
  );

  const dispositivos = Array.from({ length: 12 }, (_, i) => ({
    id: id(201 + i),
    carrierAccountId: CARRIER,
    imei: imei(i + 1),
    label: `TK-ESC-${String(i + 1).padStart(3, "0")}`,
    retiredAt: null as Date | null,
    retiredReason: null as string | null,
  }));
  // 009: de baja, soltado. 010: de baja y con la asignación abierta (anomalía).
  dispositivos[8]!.retiredAt = hace(10 * DIA);
  dispositivos[8]!.retiredReason = "Escenario: sin datos desde el corte";
  dispositivos[9]!.retiredAt = hace(2 * DIA);
  dispositivos[9]!.retiredReason = "Escenario: dado de baja sin soltarlo";
  await db.insert(devices).values(dispositivos);

  const montaje = (unidad: number, dispositivo: number, desde: Date, hasta: Date | null = null) => ({
    unitId: id(unidad),
    deviceId: id(dispositivo),
    validFrom: desde,
    validTo: hasta,
  });
  await db.insert(deviceAssignments).values([
    montaje(101, 201, hace(30 * DIA)),
    montaje(102, 202, hace(30 * DIA)),
    montaje(103, 203, hace(30 * DIA)),
    montaje(104, 204, hace(30 * DIA)),
    montaje(105, 205, hace(2 * HORA)), // recién montado, nunca reportó
    montaje(106, 206, hace(30 * DIA)),
    montaje(107, 209, hace(60 * DIA), hace(10 * DIA)), // 10301 tuvo al 009 y lo soltó
    montaje(108, 210, hace(30 * DIA)), // 010 de baja sin soltar
    montaje(110, 211, hace(30 * DIA)),
    montaje(111, 212, hace(30 * DIA)),
  ]);

  // Cada unidad en su calle de Juárez: todas en el mismo punto se encimarían en el mapa.
  const DONDE: Record<number, [number, number]> = {
    1: [31.7215, -106.4655],
    2: [31.7392, -106.4870],
    3: [31.6904, -106.4245],
    4: [31.6718, -106.4462],
    6: [31.7056, -106.3902],
    7: [31.7420, -106.4300],
    11: PLANTA_ADENTRO,
    12: [PLANTA_ADENTRO[0] + 0.0012, PLANTA_ADENTRO[1] + 0.0010],
  };
  const viva = (n: number, recordedAt: Date, speed: number | null, heading: number | null) => ({
    imei: imei(n),
    carrierAccountId: CARRIER,
    deviceId: id(200 + n),
    latitude: DONDE[n]?.[0] ?? 31.7,
    longitude: DONDE[n]?.[1] ?? -106.45,
    speed,
    heading,
    recordedAt,
    collectedAt: recordedAt,
  });
  await db.insert(livePositions).values([
    viva(1, hace(14_000), 42.7, 135),
    viva(2, hace(2.1 * MIN), 0.8, 300),
    viva(3, hace(2 * HORA), 38, 90),
    viva(4, hace(3.8 * HORA), 0, 0),
    viva(6, hace(3 * DIA), 0, 0),
    viva(7, hace(5 * DIA), 0, 0),
    viva(11, hace(20_000), 0, null),
    viva(12, hace(25_000), 18.4, 60),
  ]);

  // ── EN DESTINO (C2): la planta, su destino, y el servicio especial vigente ──
  await db.insert(accounts).values({ id: CLIENTE, type: "client", name: "Escenario cliente", slug: `${SLUG}-cliente` });
  await db.insert(plants).values({ id: id(301), clientAccountId: CLIENTE, name: "Planta del escenario", code: "ESC-P1" });
  await db.insert(geofences).values([
    {
      id: id(302),
      ownerType: "plant",
      ownerPlantId: id(301),
      role: "destino",
      name: "Planta del escenario",
      polygon: PLANTA_POLIGONO,
    },
    {
      id: id(303),
      ownerType: "carrier",
      ownerCarrierAccountId: CARRIER,
      role: "base",
      name: "Base del escenario",
      polygon: [
        { lat: 31.6990, lng: -106.4760 },
        { lat: 31.6990, lng: -106.4700 },
        { lat: 31.7035, lng: -106.4700 },
        { lat: 31.7035, lng: -106.4760 },
      ],
    },
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
  await db.insert(routes).values({ id: id(305), clientAccountId: CLIENTE, plantId: id(301), name: "Ruta del escenario" });
  await db.insert(shifts).values({ id: id(306), clientAccountId: CLIENTE, plantId: id(301), name: "Primer turno", startTime: "07:00" });
  await db.insert(routeShifts).values({ id: id(307), clientAccountId: CLIENTE, plantId: id(301), routeId: id(305), shiftId: id(306) });
  await db.insert(serviceProfiles).values({
    id: id(308),
    contractId: id(304),
    routeShiftId: id(307),
    geofenceId: id(302),
    name: "Perfil del escenario",
    code: "ESC-FLOTA-1",
  });
  await db.insert(serviceProfileUnits).values({ serviceProfileId: id(308), unitId: id(110) });
  await db.insert(serviceOccurrences).values({
    id: id(309),
    serviceProfileId: id(308),
    contractId: id(304),
    routeShiftId: id(307),
    serviceDate: new Date(ahora).toISOString().slice(0, 10),
    expectedDeadline: new Date(ahora + 10 * MIN),
    expectedGeofenceId: id(302),
  });
  await db.insert(trips).values({
    serviceOccurrenceId: id(309),
    evidenceWindowStart: hace(70 * MIN),
    evidenceWindowEnd: new Date(ahora + 50 * MIN),
  });

  // La 6284 viene por la avenida, entra a la planta hace 33 min y se queda.
  const archivo = (minutos: number, lat: number, lng: number, speed: number) => ({
    carrierAccountId: CARRIER,
    imei: imei(11),
    deviceId: id(211),
    unitId: id(110),
    latitude: lat,
    longitude: lng,
    speed,
    recordedAt: hace(minutos * MIN),
    source: "traccar",
  });
  await db.insert(telemetryPoints).values([
    archivo(60, 31.7300, -106.4200, 38),
    archivo(50, 31.7350, -106.4080, 41),
    archivo(40, 31.7390, -106.3990, 35),
    archivo(34, 31.7405, -106.3960, 12),
    archivo(33, PLANTA_ADENTRO[0], PLANTA_ADENTRO[1], 6),
    archivo(23, PLANTA_ADENTRO[0], PLANTA_ADENTRO[1], 0),
    archivo(13, PLANTA_ADENTRO[0], PLANTA_ADENTRO[1], 0),
    archivo(3, PLANTA_ADENTRO[0], PLANTA_ADENTRO[1], 0),
  ]);

  // 003: el archivo llegó más lejos que la posición viva.
  await db.insert(telemetryPoints).values({
    carrierAccountId: CARRIER,
    imei: imei(3),
    deviceId: id(203),
    unitId: id(103),
    latitude: DONDE[3]![0],
    longitude: DONDE[3]![1],
    speed: 25,
    recordedAt: hace(5 * MIN),
    source: "traccar",
  });

  console.log(`[${SLUG}] sembrado a las ${new Date(ahora).toISOString()} — las edades valen desde ahí.`);
  console.log(`[${SLUG}] cuenta: ${CARRIER} (${SLUG})`);
  console.log(`[${SLUG}] revisar:      pnpm --filter @jtel/services escenario-flota-compas-revisar`);
  console.log(`[${SLUG}] al terminar:  pnpm --filter @jtel/db escenario-flota-compas --limpiar`);
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

console.log(
  `[${SLUG}] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}` +
    ` · distinta de: ${veredicto.comparadaCon.join(", ") || "(nada que comparar)"}`,
);

const db = createDb(process.env.DATABASE_URL_TEST!);

if (args.includes("--limpiar")) await limpiar(db);
else await sembrar(db);

process.exit(0);
