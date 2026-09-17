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
 *
 *   RECORRIDO DEL DISPOSITIVO (Ver ‹dispositivo› → Recorridos, ventana «Ayer»)
 *   TK-ESC-013  ayer: 10301 hasta las 07:42 (con un hueco), soltado a taller,
 *               en bodega con puntos 08:05–09:20, montado en 10330 a las 11:10;
 *               la 10330 daba un especial 12:00–15:00 y se corta en la planta.
 *   TK-ESC-014  ayer: sin unidad y sin puntos hasta las 11:10, montado en 10310
 *               (inactiva) con un hueco a media tarde.
 *   10330       unidad nueva, trae al 013 desde ayer (en línea, hace 47 s).
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
  const imeis = Array.from({ length: 14 }, (_, i) => imei(i + 1));
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
    { n: 112, label: "10330", active: true },
  ];
  await db.insert(units).values(
    unidades.map((u) => ({ id: id(u.n), carrierAccountId: CARRIER, label: u.label, active: u.active })),
  );

  const dispositivos = Array.from({ length: 14 }, (_, i) => ({
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

  await sembrarRecorridoDeAyer(db, ahora);

  console.log(`[${SLUG}] sembrado a las ${new Date(ahora).toISOString()} — las edades valen desde ahí.`);
  console.log(`[${SLUG}] cuenta: ${CARRIER} (${SLUG})`);
  console.log(`[${SLUG}] revisar:      pnpm --filter @jtel/services escenario-flota-compas-revisar`);
  console.log(`[${SLUG}] al terminar:  pnpm --filter @jtel/db escenario-flota-compas --limpiar`);
}

/**
 * Un instante de Juárez: `fecha` y `hh:mm` en la zona, a UTC. La base guarda
 * instantes; sembrar «07:42» sin zona lo pondría a la hora del reloj de quien
 * siembra.
 */
function enJuarez(fecha: string, hhmm: string): Date {
  const supuesto = new Date(`${fecha}T${hhmm}:00Z`);
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Ciudad_Juarez",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(supuesto)
      .map((p) => [p.type, p.value]),
  );
  const leido = Date.parse(`${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}:00Z`);
  return new Date(supuesto.getTime() - (leido - supuesto.getTime()));
}

/** El día de ayer en Juárez, «2026-09-16». */
function ayerEnJuarez(ahora: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Ciudad_Juarez" }).format(new Date(ahora - DIA));
}

/**
 * El día de ayer de TK-ESC-013 y TK-ESC-014 (ver arriba). Un punto por minuto
 * en línea recta entre esquinas: lo que importa aquí son las etapas, no la calle.
 */
async function sembrarRecorridoDeAyer(db: ReturnType<typeof createDb>, ahora: number) {
  const f = ayerEnJuarez(ahora);
  const h = (hhmm: string) => enJuarez(f, hhmm);
  const QUIEN = "coordinador-del-escenario";

  await db.insert(deviceAssignments).values([
    {
      unitId: id(107),
      deviceId: id(213),
      validFrom: new Date(h("00:00").getTime() - 3 * DIA),
      validTo: h("07:42"),
      cerradaPor: QUIEN,
      motivoCierre: "Escenario: falla de alimentación, a taller",
    },
    { unitId: id(112), deviceId: id(213), validFrom: h("11:10"), validTo: null, asignadaPor: QUIEN },
    { unitId: id(109), deviceId: id(214), validFrom: h("11:10"), validTo: null, asignadaPor: QUIEN },
  ]);

  type Esquina = [number, number];
  const tramo = (n: number, unidad: number | null, desde: string, hasta: string, de: Esquina, a: Esquina, speed = 38) => {
    const t0 = h(desde).getTime();
    const minutos = Math.round((h(hasta).getTime() - t0) / MIN);
    return Array.from({ length: minutos + 1 }, (_, i) => {
      const k = minutos === 0 ? 0 : i / minutos;
      return {
        carrierAccountId: CARRIER,
        imei: imei(n),
        deviceId: id(200 + n),
        unitId: unidad === null ? null : id(unidad),
        latitude: de[0] + k * (a[0] - de[0]),
        longitude: de[1] + k * (a[1] - de[1]),
        speed,
        recordedAt: new Date(t0 + i * MIN),
        source: "traccar",
      };
    });
  };

  const BASE: Esquina = [31.7012, -106.4730];
  const CRUCE: Esquina = [31.7150, -106.4500];
  const TALLER: Esquina = [31.7350, -106.4400];
  const BANCO: Esquina = [31.7280, -106.4200];
  const CERCA: Esquina = [31.7398, -106.3955];
  const ADENTRO: Esquina = [31.7425, -106.3915];
  const SALIDA: Esquina = [31.7470, -106.3860];
  const LEJOS: Esquina = [31.7600, -106.3700];

  const puntos = [
    // 013 en la 10301: sale de la base, hueco de 19 min, llega al taller.
    ...tramo(13, 107, "05:20", "06:31", BASE, CRUCE),
    ...tramo(13, 107, "06:50", "07:41", CRUCE, TALLER),
    // 013 en bodega: del taller al banco, y ahí se queda.
    ...tramo(13, null, "08:05", "08:35", TALLER, BANCO, 30),
    ...tramo(13, null, "08:40", "09:20", BANCO, BANCO, 0).filter((_, i) => i % 5 === 0),
    // 013 en la 10330: del banco a la planta (especial 12:00–15:00), adentro, y sale.
    ...tramo(13, 112, "11:24", "12:47", BANCO, CERCA),
    ...tramo(13, 112, "12:48", "13:21", ADENTRO, ADENTRO, 0).filter((_, i) => i % 3 === 0),
    ...tramo(13, 112, "13:22", "15:30", SALIDA, LEJOS),
    // 014 en la 10310, con un hueco de media hora.
    ...tramo(14, 109, "11:24", "12:10", CRUCE, TALLER),
    ...tramo(14, 109, "12:40", "14:00", TALLER, BANCO),
  ];
  for (let i = 0; i < puntos.length; i += 200) await db.insert(telemetryPoints).values(puntos.slice(i, i + 200));

  // El especial de la 10330, ayer: la misma planta del escenario.
  await db.insert(serviceProfileUnits).values({ serviceProfileId: id(308), unitId: id(112) });
  await db.insert(serviceOccurrences).values({
    id: id(310),
    serviceProfileId: id(308),
    contractId: id(304),
    routeShiftId: id(307),
    serviceDate: f,
    expectedDeadline: h("13:00"),
    expectedGeofenceId: id(302),
  });
  await db.insert(trips).values({ serviceOccurrenceId: id(310), evidenceWindowStart: h("12:00"), evidenceWindowEnd: h("15:00") });

  // La 10330 sigue viva hoy, donde terminó.
  await db.insert(livePositions).values({
    imei: imei(13),
    carrierAccountId: CARRIER,
    deviceId: id(213),
    latitude: LEJOS[0],
    longitude: LEJOS[1],
    speed: 0,
    heading: null,
    recordedAt: new Date(ahora - 47_000),
    collectedAt: new Date(ahora - 47_000),
  });
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
