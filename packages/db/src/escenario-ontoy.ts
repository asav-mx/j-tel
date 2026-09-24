import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { inArray } from "drizzle-orm";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import {
  accounts,
  circuitPaths,
  circuitStopVersions,
  circuitStops,
  circuitUnitAssignments,
  circuits,
  circuitPromiseBands,
  circuitPromiseTables,
  deviceAssignments,
  devices,
  livePositions,
  units,
} from "./schema/index.js";

/**
 * El escenario de ONTOY — la ciudad, para poder mirar la app del pasajero.
 *
 *   pnpm --filter @jtel/db escenario-ontoy
 *   pnpm --filter @jtel/db escenario-ontoy --un-sentido   # Insurgentes sin paradas de vuelta
 *   pnpm --filter @jtel/db escenario-ontoy --limpiar
 *
 * Tres rutas publicadas, porque las tres cosas que la app tiene que saber decir
 * son distintas y no se ven con una sola:
 *
 *   Oasis–Centro    abierta, con unidades — una fresca y una con dato viejo
 *   Insurgentes     abierta y SIN unidades a la vista
 *   Panamericana    fuera de horario
 *
 * La de dato viejo es la que más prueba: tiene que dibujarse **apagada y con
 * otra forma**, no borrarse (8.9) y no pintarse como si fuera de ahorita.
 *
 * Vive sólo en la rama desechable, lo mira quien lo sembró y se borra con
 * `--limpiar`. Mismo trato que los demás escenarios.
 */

function archivosDeAmbiente(): string[] {
  const base = ["../../.env", ".env"];
  try {
    const comun = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      encoding: "utf8",
    }).trim();
    base.push(join(dirname(comun), ".env"));
  } catch {
    /* fuera de un repo, los dos de arriba bastan */
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

const CUENTAS = {
  concesion: "f4000000-0000-4000-8000-000000000001",
  carrier: "f4000000-0000-4000-8000-000000000002",
};
const ZONA = "America/Ciudad_Juarez";
const LON = -106.45;

/** `--zona` por la misma razón que en la torre: el día civil del circuito manda. */
const zona = (() => {
  const i = process.argv.indexOf("--zona");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : ZONA;
})();

const hhmm = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);

interface Semilla {
  id: string;
  nombre: string;
  slug: string;
  color: string;
  frecuencia: number;
  lonOffset: number;
  paradas: string[];
  /** Cerrada = su horario ya pasó, para ver «fuera de horario · abre …». */
  cerrada?: boolean;
  unidades: Array<{ label: string; imei: string; t: number; edadSeg: number }>;
}

const SEMILLAS: Semilla[] = [
  {
    id: "f4000000-0000-4000-8000-000000000010",
    /*
     * **No se llama «Oasis–Centro» a propósito.** `escenario-torre` ya siembra
     * un circuito con ese nombre en la misma rama desechable, y dos fixtures
     * homónimos con horarios distintos hacen que una revisión honesta parezca
     * un error de zona horaria — pasó el 21-sep. Un fixture que confunde a
     * quien revisa cuesta más de lo que ahorra.
     */
    nombre: "Zaragoza–Centro",
    slug: "zaragoza-centro",
    // Un amarillo de ruta real: NO cumple 3:1 sobre el papel claro, y por eso
    // la traza sale con halo. Es el caso que la 8.8c vino a resolver.
    color: "#FFB81C",
    frecuencia: 12,
    lonOffset: 0,
    paradas: ["Zaragoza Sur", "Zaragoza y Torres", "Las Torres", "Zaragoza y Ejército", "Ejército Nacional", "Centro"],
    unidades: [
      { label: "2120", imei: "FIXTURE-ONTOY-2120", t: 0.46, edadSeg: 11 },
      // Dato viejo: se apaga y cambia de forma. No se borra (8.9).
      { label: "2087", imei: "FIXTURE-ONTOY-2087", t: 0.14, edadSeg: 9 * 60 },
    ],
  },
  {
    id: "f4000000-0000-4000-8000-000000000011",
    nombre: "Insurgentes",
    slug: "insurgentes",
    color: "#2EC4B6",
    frecuencia: 20,
    lonOffset: 0.012,
    paradas: ["Km 20", "División del Norte", "Tecnológico", "Centro Norte"],
    unidades: [],
  },
  {
    id: "f4000000-0000-4000-8000-000000000012",
    nombre: "Panamericana",
    slug: "panamericana",
    color: "#E85D9A",
    frecuencia: 15,
    lonOffset: -0.012,
    paradas: ["Puente Sur", "Panamericana y Vías", "Glorieta"],
    cerrada: true,
    unidades: [],
  },
];

const IMEIS = SEMILLAS.flatMap((s) => s.unidades.map((u) => u.imei));
const lat = (i: number, n: number) => 31.7 + (i / Math.max(1, n - 1)) * 0.05;

async function limpiar(db: ReturnType<typeof createDb>) {
  await db.delete(livePositions).where(inArray(livePositions.imei, IMEIS));
  try {
    await db.delete(accounts).where(inArray(accounts.id, Object.values(CUENTAS)));
  } catch (e) {
    /*
     * **El libro de boletos manda sobre el plan** (0054, P3.5). Sus renglones
     * apuntan a la unidad y al circuito con `ON DELETE RESTRICT`, así que una
     * ciudad donde ya se quemaron boletos **no se puede tirar** — y eso no es
     * una falla del guion: es la garantía funcionando.
     *
     * Se dice con todas sus letras en vez de dejar salir el error crudo de
     * Postgres, que aquí se leería como «el escenario está roto».
     */
    if ((e as { cause?: { code?: string } })?.cause?.code === "23503") {
      console.error(
        "\n  ✗ [escenario-ontoy] esta ciudad ya tiene viajes en el libro de boletos." +
          "\n    El libro no pierde renglones, así que su unidad tampoco se borra (0054)." +
          "\n    Para empezar de cero, se tira la RAMA desechable entera y se vuelve a" +
          "\n    construir con las migraciones.\n",
      );
      process.exit(1);
    }
    throw e;
  }
  console.log("[escenario-ontoy] borrado.");
}

/**
 * `unSentido`: las paradas de Insurgentes quedan sólo de ida, y su vuelta sin
 * ninguna — para ver que el mapa no invita a tocar lo que no existe.
 */
async function sembrar(db: ReturnType<typeof createDb>, unSentido: boolean) {
  const ahora = new Date();
  await limpiar(db);

  await db.insert(accounts).values([
    { id: CUENTAS.concesion, type: "concesion", name: "Concesión de ciudad", slug: "ontoy-concesion", isDemo: true },
    { id: CUENTAS.carrier, type: "carrier", name: "Transportes de ciudad", slug: "ontoy-carrier", isDemo: true },
  ]);

  let aparato = 0;
  for (const s of SEMILLAS) {
    const trazado: Array<[number, number]> = s.paradas.map((_, i) => [
      LON + s.lonOffset,
      lat(i, s.paradas.length),
    ]);

    await db.insert(circuits).values({
      id: s.id,
      concessionAccountId: CUENTAS.concesion,
      name: s.nombre,
      publicSlug: s.slug,
      staleAfterSeconds: 180,
      arrivalRangeFloorSeconds: 180,
      corridorToleranceMeters: 150,
      serviceConfidenceMinutes: 15,
      arrivalTolerancePct: 50,
      avgSpeedKmh: 22,
      colorHex: s.color,
      serviceLaunchDate: null,
      // La cerrada abrió y cerró ya; las otras están abiertas ahorita.
      serviceStartLocal: s.cerrada ? "05:00:00" : `${hhmm(new Date(ahora.getTime() - 60 * 60_000))}:00`,
      serviceEndLocal: s.cerrada ? `${hhmm(new Date(ahora.getTime() - 30 * 60_000))}:00` : "23:59:00",
      timeZone: zona,
      active: true,
      // Publicado: sin esto la app no lo enseña (8.4).
      publishedAt: ahora,
      arrivalRangeEnabledAt: ahora,
    });

    /*
     * La promesa, por franja — la única fuente de la promesa (21 sep 2026).
     * Una franja que cubre el horario, los tres tipos de día: lo que el número
     * único decía antes. `validFrom` atrás, como en el escenario de la torre,
     * para que la promesa ya valga en todo instante que la app pregunte.
     */
    const inicio = s.cerrada ? "05:00" : hhmm(new Date(ahora.getTime() - 60 * 60_000));
    const fin = s.cerrada ? hhmm(new Date(ahora.getTime() - 30 * 60_000)) : "23:59";
    const [tabla] = await db
      .insert(circuitPromiseTables)
      .values({ circuitId: s.id, validFrom: new Date(ahora.getTime() - 30 * 24 * 3_600_000) })
      .returning();
    if (inicio < fin) {
      await db.insert(circuitPromiseBands).values(
        (["entre_semana", "sabado", "domingo"] as const).map((diaTipo) => ({
          promiseTableId: tabla!.id,
          diaTipo,
          sentido: null,
          desdeLocal: `${inicio}:00`,
          hastaLocal: `${fin}:00`,
          frequencyMinutes: s.frecuencia,
        })),
      );
    }

    await db.insert(circuitPaths).values([
      { circuitId: s.id, sentido: "ida", coordinates: trazado, pointCount: trazado.length, lengthMeters: 5500 },
      { circuitId: s.id, sentido: "vuelta", coordinates: [...trazado].reverse(), pointCount: trazado.length, lengthMeters: 5500 },
    ]);

    for (const [i, nombre] of s.paradas.entries()) {
      const [parada] = await db
        .insert(circuitStops)
        .values({ circuitId: s.id, qrSlug: `${s.slug}-${i + 1}` })
        .returning();
      await db.insert(circuitStopVersions).values({
        stopId: parada!.id,
        name: nombre,
        orden: i + 1,
        latitude: lat(i, s.paradas.length),
        longitude: LON + s.lonOffset,
        sentido: unSentido && s.slug === "insurgentes" ? "ida" : null,
      });
    }

    for (const u of s.unidades) {
      const idUnidad = `f4000000-0000-4000-8000-0000000001${(aparato + 10).toString(16).padStart(2, "0")}`;
      const idAparato = `f4000000-0000-4000-8000-0000000002${(aparato + 10).toString(16).padStart(2, "0")}`;
      aparato += 1;
      await db.insert(units).values({ id: idUnidad, carrierAccountId: CUENTAS.carrier, label: u.label, active: true });
      await db.insert(circuitUnitAssignments).values({
        circuitId: s.id,
        unitId: idUnidad,
        carrierAccountId: CUENTAS.carrier,
        validFrom: new Date(ahora.getTime() - 30 * 24 * 3_600_000),
      });
      await db.insert(devices).values({ id: idAparato, carrierAccountId: CUENTAS.carrier, imei: u.imei, label: `TK-${u.label}` });
      await db.insert(deviceAssignments).values({
        unitId: idUnidad,
        deviceId: idAparato,
        validFrom: new Date(ahora.getTime() - 30 * 24 * 3_600_000),
      });
      const i = Math.round(u.t * (s.paradas.length - 1));
      await db.insert(livePositions).values({
        imei: u.imei,
        carrierAccountId: CUENTAS.carrier,
        deviceId: idAparato,
        latitude: lat(i, s.paradas.length) + 0.002,
        longitude: LON + s.lonOffset,
        speed: 32,
        heading: 0,
        recordedAt: new Date(ahora.getTime() - u.edadSeg * 1000),
        collectedAt: ahora,
      });
    }
  }

  console.log(`[escenario-ontoy] sembrado · ${SEMILLAS.length} rutas publicadas`);
  console.log("[escenario-ontoy] app:  http://localhost:3100/");
  console.log("[escenario-ontoy] al terminar:  pnpm --filter @jtel/db escenario-ontoy --limpiar");
}

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");
const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
  confirmacion: iBase >= 0 ? args[iBase + 1] : undefined,
});
if (!veredicto.ok) {
  console.error(`\n  ✗ [escenario-ontoy] ${veredicto.motivo}\n`);
  process.exit(1);
}
console.log(`[escenario-ontoy] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}`);

const db = createDb(process.env.DATABASE_URL_TEST!);
if (args.includes("--limpiar")) await limpiar(db);
else await sembrar(db, args.includes("--un-sentido"));
process.exit(0);
