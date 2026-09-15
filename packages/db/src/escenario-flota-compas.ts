import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import { accounts, deviceAssignments, devices, livePositions, telemetryPoints, units } from "./schema/index.js";

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
 *
 *   DISPOSITIVOS (además de los montados de arriba)
 *   TK-ESC-007  en bodega            última señal hace 5 días
 *   TK-ESC-008  en bodega            nunca reportó
 *   TK-ESC-009  de baja              con fecha y motivo, ya soltado
 *   TK-ESC-010  de baja              sin soltar de 10320 (la anomalía de arriba)
 *
 * **No hay unidad en destino, porque el estado no existe todavía:** llega con la
 * detección en vivo, junto con el mapa.
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

const id = (n: number) => `f3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const imei = (n: number) => `FIXTURE-FLOTA-${String(n).padStart(3, "0")}`;

const MIN = 60_000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

async function limpiar(db: ReturnType<typeof createDb>) {
  const imeis = Array.from({ length: 10 }, (_, i) => imei(i + 1));
  // `live_positions` y `telemetry_points` no cuelgan del carrier por IMEI: se
  // borran por su IMEI de fixture antes de soltar la cuenta.
  await db.delete(livePositions).where(inArray(livePositions.imei, imeis));
  await db.delete(telemetryPoints).where(inArray(telemetryPoints.imei, imeis));
  // Unidades, dispositivos y asignaciones caen en cascada con la cuenta.
  await db.delete(accounts).where(eq(accounts.id, CARRIER));
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
  ];
  await db.insert(units).values(
    unidades.map((u) => ({ id: id(u.n), carrierAccountId: CARRIER, label: u.label, active: u.active })),
  );

  const dispositivos = Array.from({ length: 10 }, (_, i) => ({
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
  ]);

  const viva = (n: number, recordedAt: Date, speed: number | null, heading: number | null) => ({
    imei: imei(n),
    carrierAccountId: CARRIER,
    deviceId: id(200 + n),
    latitude: 31.7,
    longitude: -106.45,
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
  ]);

  // 003: el archivo llegó más lejos que la posición viva.
  await db.insert(telemetryPoints).values({
    carrierAccountId: CARRIER,
    imei: imei(3),
    deviceId: id(203),
    unitId: id(103),
    latitude: 31.7,
    longitude: -106.45,
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
