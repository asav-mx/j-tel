import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import {
  accounts,
  circuitPaths,
  circuitPromiseBands,
  circuitPromiseTables,
  circuitStopPasses,
  circuitDetectionMarks,
  circuitStopVersions,
  circuitStops,
  circuitUnitAssignments,
  circuits,
  concessionCarriers,
  deviceAssignments,
  devices,
  livePositions,
  telemetryPoints,
  units,
  userMemberships,
} from "./schema/index.js";

/**
 * El escenario de LA TORRE — para poder mirarla viva (Paso 2 del radar).
 *
 *   pnpm --filter @jtel/db escenario-torre                # la torre llena
 *   pnpm --filter @jtel/db escenario-torre --compartido   # + otro transportista (9.14)
 *   pnpm --filter @jtel/db escenario-torre --vacio        # el circuito sin capturar
 *   pnpm --filter @jtel/db escenario-torre --sin-unidades # paradas y promesa, ningún camión asignado
 *   pnpm --filter @jtel/db escenario-torre --sin-salir    # camiones asignados, ninguno al aire
 *   pnpm --filter @jtel/db escenario-torre --jornada      # el día de la 2120, para la hoja de la jornada (PR C)
 *   pnpm --filter @jtel/db escenario-torre --asignar      # + lo que hace falta para ver asignar (PR 2)
 *   pnpm --filter @jtel/db escenario-torre --limpiar
 *
 * ## Por qué un escenario y no la calle
 *
 * La torre sólo dice algo con **pasos por parada ya detectados**, y hoy no hay
 * un circuito real capturado con su promesa por franja y su detector corrido.
 * Sin esto no hay forma de ver la pantalla viva, y una pantalla de piel que no
 * se vio no está revisada: compilar no prueba nada.
 *
 * ## Por qué no viola §D ni §E del Marco
 *
 * No hay receptor. Vive en la rama desechable, lo mira quien lo sembró y se
 * borra con `--limpiar`. Lo prohibido es sembrar producción o dejar esto donde
 * un pasajero lo lea; lo primero lo cierra `candado-desechable`, lo segundo el
 * `--limpiar`. Mismo trato que `escenario-arranque`.
 *
 * ## Los cinco camiones, y por qué son cinco
 *
 * Uno por cada cosa que la torre tiene que saber decir sin mentir:
 *
 *   2120  EN RANGO      su último intervalo cayó dentro de la banda
 *   2126  ADELANTADA    intervalo de 4 min contra una banda de 5–15
 *   2101  ATRASADA      intervalo de 18 min
 *   2109  SIN SEÑAL     fix de hace 11 min: situación, no veredicto (1.E)
 *   2115  SIN DATOS     corre y todavía no cruza una parada — `sin_pasos`
 *
 * Los dos últimos son los que más prueban: son los dos huecos que la pantalla
 * tiene que decir distinto, y aplanarlos en una sola palabra es justo lo que el
 * Marco §D prohíbe.
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

/** Ids fijos: es lo que hace la siembra repetible en vez de acumulativa. */
const IDS = {
  concesion: "f3000000-0000-4000-8000-000000000001",
  carrier: "f3000000-0000-4000-8000-000000000002",
  otroCarrier: "f3000000-0000-4000-8000-000000000003",
  circuito: "f3000000-0000-4000-8000-000000000004",
  promesa: "f3000000-0000-4000-8000-000000000005",
  concesionVecina: "f3000000-0000-4000-8000-000000000006",
  circuitoVecino: "f3000000-0000-4000-8000-000000000007",
} as const;

/**
 * `--asignar`: los camiones que hacen falta para ver Relaciones de Ver
 * ‹circuito› decir todo lo que sabe decir (ficha de huecos de asignar, PR 2).
 *
 *   2130  libre         se asigna sin aviso
 *   2131  en otro       corre un circuito de OTRA concesión: el aviso §4
 *   2124  ya corrió     asignación cerrada, con motivo y autor (0048)
 */
const PARA_ASIGNAR = {
  libre: { id: "f3000000-0000-4000-8000-00000000003a", label: "2130" },
  enOtro: { id: "f3000000-0000-4000-8000-00000000003b", label: "2131" },
  yaCorrio: { id: "f3000000-0000-4000-8000-00000000003c", label: "2124" },
} as const;

const SLUG = "escenario-torre";
/**
 * La zona del circuito. Juárez es la real y es la de omisión.
 *
 * `--zona` existe por una razón concreta: **el día civil del circuito manda**.
 * La apertura declarada ancla el primer paso del día y acota la lectura, así
 * que recién pasada la medianoche local sólo existen los minutos que lleva el
 * día nuevo, y una torre sembrada a esa hora sale legítimamente vacía. Para
 * mirar la pantalla llena a cualquier hora del reloj de quien la revisa, se
 * corre el escenario en una zona donde ya haya día atrás. Nada de lo que la
 * pantalla dibuja depende de cuál sea: la zona no se muestra.
 */
const ZONA = (() => {
  const i = process.argv.indexOf("--zona");
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : "America/Ciudad_Juarez";
})();
/** El usuario con que se mira. `JTEL_DEV_USER=escenario-torre-operador`. */
const OPERADOR = "escenario-torre-operador";

const LON = -106.45;
const PARADAS = [
  "Oasis",
  "Zaragoza",
  "Independencia",
  "Tecnológico",
  "López Mateos",
  "16 de Septiembre",
  "Catedral",
  "Centro",
];
/** Una recta de norte a sur; la vuelta es la misma al revés. */
const LAT = (i: number) => 31.7 + i * 0.006;
const TRAZADO_IDA: Array<[number, number]> = PARADAS.map((_, i) => [LON, LAT(i)]);
const TRAZADO_VUELTA = [...TRAZADO_IDA].reverse();

const CAMIONES = [
  { id: "f3000000-0000-4000-8000-00000000001a", label: "2120", imei: "FIXTURE-TORRE-2120" },
  { id: "f3000000-0000-4000-8000-00000000001b", label: "2126", imei: "FIXTURE-TORRE-2126" },
  { id: "f3000000-0000-4000-8000-00000000001c", label: "2101", imei: "FIXTURE-TORRE-2101" },
  { id: "f3000000-0000-4000-8000-00000000001d", label: "2109", imei: "FIXTURE-TORRE-2109" },
  { id: "f3000000-0000-4000-8000-00000000001e", label: "2115", imei: "FIXTURE-TORRE-2115" },
] as const;
const DE_OTRO = { id: "f3000000-0000-4000-8000-00000000002a", label: "3301" };
const APARATO = (i: number) => `f3000000-0000-4000-8000-0000000000${(0x30 + i).toString(16)}`;

const IMEIS = [...CAMIONES.map((c) => c.imei)];
const unidadPorLabel = new Map<string, string>(CAMIONES.map((c) => [c.label, c.id]));
const MIN = 60_000;

/**
 * La cadena de pasos de una parada: `[minutosAtrás, camión]`, del más viejo al
 * más reciente. Los intervalos que producen las palabras de la pantalla están
 * escritos aquí y no calculados, para que la siembra se pueda leer y discutir.
 */
type Cadena = Array<[number, string]>;

const CADENA_IDA: Record<string, Cadena> = {
  // 2120 cierra con un intervalo de 10 min: EN RANGO.
  Tecnológico: [[44, "2126"], [34, "2120"], [24, "2126"], [14, "2126"], [4, "2120"]],
  // 2126 cierra con 4 min contra una banda de 5–15: ADELANTADA.
  Independencia: [[37, "2120"], [27, "2126"], [17, "2120"], [7, "2120"], [3, "2126"]],
};
const CADENA_VUELTA: Record<string, Cadena> = {
  // 2101 cierra con 18 min: ATRASADA.
  "López Mateos": [[40, "2109"], [30, "2101"], [22, "2109"], [20, "2101"], [2, "2101"]],
};
/** El resto de las paradas: una cadena pareja de 10 min, que no cambia ningún último paso. */
const PAREJA_IDA: Cadena = [[40, "2126"], [30, "2120"], [20, "2126"], [10, "2120"]];
const PAREJA_VUELTA: Cadena = [[45, "2101"], [35, "2109"], [25, "2101"], [17, "2109"]];

/** La hora local HH:MM:SS de `ahora` menos N minutos, sin cruzar a ayer. */
function horaLocal(ahora: Date, menosMinutos: number): string {
  const t = new Date(ahora.getTime() - menosMinutos * MIN);
  const hhmm = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(t);
  const deHoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(t);
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(ahora);
  // Si restar cruzó a ayer, el servicio abre a medianoche y ya: lo que importa
  // es que la apertura caiga HOY y antes del primer paso sembrado.
  return deHoy === hoy ? `${hhmm}:00` : "00:01:00";
}

/**
 * `--jornada`: el día de la 2120 para ver la hoja de la jornada (PR C). Cuatro
 * vueltas, una por cada cosa que la hoja tiene que saber decir sin mentir:
 *
 *   V1 ida     completa — pasos por las ocho paradas; la 2126 pasó antes por
 *              cada una (intervalos del servicio), y en Tecnológico pegadita
 *              (intervalo corto)
 *   V2 vuelta  incompleta · salió del corredor en López Mateos — 12 min a
 *              1.1 km de la ruta, medidos
 *   V3 ida     SIN DATOS — calla 23 min después de López Mateos
 *   V4 vuelta  todavía no se mide — la marca del detector se quedó a la mitad
 *
 * Las posiciones son archivadas (telemetry_points) cada 30 s, en el aparato de
 * la 2120; los pasos son los que el detector habría sellado.
 */
async function sembrarJornada(
  db: ReturnType<typeof createDb>,
  ahora: Date,
  versiones: Array<{ nombre: string; stopId: string; versionId: string }>,
) {
  const T0 = ahora.getTime() - 290 * MIN;
  const t = (min: number) => new Date(T0 + min * MIN);
  const u2120 = unidadPorLabel.get("2120")!;
  const u2126 = unidadPorLabel.get("2126")!;
  const lat = (i: number) => LAT(i);
  const puntos: Array<typeof telemetryPoints.$inferInsert> = [];
  /** Posiciones cada 30 s de `de` a `a` minutos, avanzando de la parada i a la j (o quieta fuera de la ruta). */
  const recorrer = (de: number, a: number, desdeParada: number, hastaParada: number, lonExtra = 0) => {
    const n = Math.round((a - de) * 2);
    for (let k = 0; k <= n; k += 1) {
      const f = n === 0 ? 0 : k / n;
      puntos.push({
        carrierAccountId: IDS.carrier,
        deviceId: APARATO(0),
        unitId: u2120,
        imei: "FIXTURE-TORRE-2120",
        latitude: lat(desdeParada) + (lat(hastaParada) - lat(desdeParada)) * f,
        longitude: LON + lonExtra,
        speed: 22,
        recordedAt: t(de + k / 2),
        source: "escenario",
      });
    }
  };
  const pasos: Array<typeof circuitStopPasses.$inferInsert> = [];
  const paso = (unitId: string, i: number, sentido: "ida" | "vuelta", min: number) => {
    const v = versiones[i]!;
    pasos.push({
      circuitId: IDS.circuito,
      stopId: v.stopId,
      stopVersionId: v.versionId,
      unitId,
      sentido,
      pasoDesde: t(min),
      pasoHasta: new Date(t(min).getTime() + 18_000),
      huecoSegundos: 18,
      detectorVersion: "orquestador-v1",
    });
  };

  // V1 · ida, completa. La 2126 va 12 min adelante; en Tecnológico, sólo 2.
  recorrer(-10, 0, 0, 0);
  recorrer(0, 28, 0, 7);
  for (let i = 0; i < 8; i += 1) {
    paso(u2120, i, "ida", 4 * i);
    paso(u2126, i, "ida", 4 * i - (i === 3 ? 2 : 12));
  }
  // V2 · vuelta: pasa de Centro a López Mateos, sale 12 min del corredor, vuelve cerca de Oasis sin pasar por lo que faltaba.
  recorrer(28.5, 34.5, 7, 7);
  recorrer(35, 47, 7, 4);
  for (const [k, i] of [7, 6, 5, 4].entries()) paso(u2120, i, "vuelta", 35 + 4 * k);
  recorrer(47.5, 48, 4, 4);
  recorrer(48.5, 60.5, 4, 3, 0.012);
  recorrer(61, 74, 1, 0);
  // V3 · ida: Oasis → López Mateos, y calla 23 min.
  recorrer(74.5, 91, 0, 4);
  for (let i = 0; i <= 4; i += 1) paso(u2120, i, "ida", 75 + 4 * i);
  recorrer(115, 128, 7, 7);
  // V4 · vuelta: Centro y Catedral; el detector se quedó a la mitad.
  recorrer(128.5, 150, 7, 4);
  paso(u2120, 7, "vuelta", 130);
  paso(u2120, 6, "vuelta", 134);

  // Los tramos comparten el minuto de frontera: una posición por instante (el índice único es aparato + hora).
  const unicos = [...new Map(puntos.map((q) => [(q.recordedAt as Date).getTime(), q])).values()];
  await db.insert(telemetryPoints).values(unicos);
  await db.insert(circuitStopPasses).values(pasos);
  await db
    .insert(circuitDetectionMarks)
    .values({ circuitId: IDS.circuito, unitId: u2120, detectorVersion: "orquestador-v1", lastPingAt: t(136) });
  console.log(`[escenario-torre] jornada · ${unicos.length} posiciones y ${pasos.length} pasos de la 2120 (y la 2126)`);
}

async function limpiar(db: ReturnType<typeof createDb>) {
  await db.delete(livePositions).where(inArray(livePositions.imei, IMEIS));
  await db.delete(circuits).where(inArray(circuits.id, [IDS.circuito, IDS.circuitoVecino]));
  await db
    .delete(accounts)
    .where(inArray(accounts.id, [IDS.concesion, IDS.carrier, IDS.otroCarrier, IDS.concesionVecina]));
  console.log("[escenario-torre] borrado.");
}

async function sembrar(
  db: ReturnType<typeof createDb>,
  opciones: { compartido: boolean; vacio: boolean; asignar: boolean; sinUnidades: boolean; sinSalir: boolean; jornada: boolean },
) {
  const ahora = new Date();
  await limpiar(db);

  await db.insert(accounts).values([
    { id: IDS.concesion, type: "concesion", name: "Concesión de escenario", slug: SLUG, isDemo: true },
    { id: IDS.carrier, type: "carrier", name: "Transportes del Norte", slug: `${SLUG}-carrier`, isDemo: true },
    { id: IDS.otroCarrier, type: "carrier", name: "Autobuses del Valle", slug: `${SLUG}-otro`, isDemo: true },
  ]);

  // Con quién se mira: `JTEL_DEV_USER=escenario-torre-operador`.
  await db.insert(userMemberships).values({
    accountId: IDS.carrier,
    clerkUserId: OPERADOR,
    role: "admin",
    scopeType: "account",
  });

  /*
   * La liga con la concesión. En la calle, un transportista que corre un
   * circuito de una concesión está ligado a ella; sin esto el escenario
   * enseñaba un carrier que corre donde nadie lo ligó. Desde el 21-sep la liga
   * además abre la lectura (tercera entrada), así que `--vacio` por fin deja
   * ver el circuito sin capturar.
   */
  await db.insert(concessionCarriers).values([
    { concessionAccountId: IDS.concesion, carrierAccountId: IDS.carrier },
    ...(opciones.compartido ? [{ concessionAccountId: IDS.concesion, carrierAccountId: IDS.otroCarrier }] : []),
  ]);

  await db.insert(circuits).values({
    id: IDS.circuito,
    concessionAccountId: IDS.concesion,
    name: "Oasis–Centro",
    publicSlug: SLUG,
    staleAfterSeconds: 180,
    arrivalRangeFloorSeconds: 180,
    corridorToleranceMeters: 150,
    serviceConfidenceMinutes: 15,
    arrivalTolerancePct: 50,
    avgSpeedKmh: 22,
    colorHex: "#b05a0f",
    serviceLaunchDate: null,
    // La jornada necesita un día con varias vueltas: abre cinco horas antes.
    serviceStartLocal: horaLocal(ahora, opciones.jornada ? 300 : 60),
    serviceEndLocal: "23:59:00",
    timeZone: ZONA,
    active: true,
  });

  if (opciones.vacio) {
    console.log("[escenario-torre] sembrado VACÍO: circuito sin paradas ni unidades.");
    console.log(`[escenario-torre] torre:  http://localhost:3000/casa/transportista/circuitos`);
    return;
  }

  await db.insert(circuitPaths).values([
    { circuitId: IDS.circuito, sentido: "ida", coordinates: TRAZADO_IDA, pointCount: TRAZADO_IDA.length, lengthMeters: 4670 },
    { circuitId: IDS.circuito, sentido: "vuelta", coordinates: TRAZADO_VUELTA, pointCount: TRAZADO_VUELTA.length, lengthMeters: 4670 },
  ]);

  /* Las paradas sirven los DOS sentidos (`sentido: null`): así la torre dibuja
     sus dos carriles con las mismas ocho, y se ve que la espera se mide por
     sentido y no por parada. */
  const versiones: Array<{ nombre: string; stopId: string; versionId: string }> = [];
  for (const [i, nombre] of PARADAS.entries()) {
    const [parada] = await db
      .insert(circuitStops)
      .values({ circuitId: IDS.circuito, qrSlug: `${SLUG}-${i}` })
      .returning();
    const [version] = await db
      .insert(circuitStopVersions)
      .values({
        stopId: parada!.id,
        name: nombre,
        orden: i + 1,
        latitude: LAT(i),
        longitude: LON,
        sentido: null,
        /*
         * Hace un mes, no «ahora»: la jornada de un día pasado se evalúa con las
         * paradas como estaban ESE día (PR B), y una parada nacida hoy no existía
         * ayer. Con el valor por omisión, la jornada de ayer salía sin vueltas.
         */
        validFrom: new Date(ahora.getTime() - 30 * 24 * 3_600_000),
      })
      .returning();
    versiones.push({ nombre, stopId: parada!.id, versionId: version!.id });
  }

  // La promesa: cada 10 min, todos los días, los dos sentidos.
  /*
   * `validFrom` bien atrás, y no el `now()` por omisión: `getPromesaEnInstante`
   * busca la versión que valía EN EL INSTANTE DEL PASO (9.1c), así que una
   * tabla nacida hace un segundo deja sin promesa a todo paso anterior — y la
   * pantalla sale diciendo «cada 10 min» arriba y «sin promesa» abajo, que es
   * una contradicción sembrada por el fixture, no por el código.
   */
  await db.insert(circuitPromiseTables).values({
    id: IDS.promesa,
    circuitId: IDS.circuito,
    validFrom: new Date(ahora.getTime() - 30 * 24 * 3_600_000),
  });
  await db.insert(circuitPromiseBands).values(
    (["entre_semana", "sabado", "domingo"] as const).map((diaTipo) => ({
      promiseTableId: IDS.promesa,
      diaTipo,
      sentido: null,
      desdeLocal: horaLocal(ahora, opciones.jornada ? 300 : 60),
      hastaLocal: "23:59:00",
      frequencyMinutes: 10,
    })),
  );

  /*
   * `--sin-unidades`: el circuito con sus paradas y su promesa, y ningún camión
   * asignado — Oasis el 21-sep. La torre dibuja el radar y lo declara, y las
   * paradas no llevan reloj (no hay a quién corregir por radio).
   */
  if (opciones.sinUnidades) {
    console.log("[escenario-torre] sembrado SIN UNIDADES: paradas y promesa, ningún camión asignado.");
    console.log(`[escenario-torre] torre:   http://localhost:3000/casa/transportista/circuitos/${IDS.circuito}`);
    console.log(`[escenario-torre] mira con:  JTEL_DEV_USER=${OPERADOR}`);
    return;
  }

  await db.insert(units).values(
    CAMIONES.map((c) => ({ id: c.id, carrierAccountId: IDS.carrier, label: c.label, active: true })),
  );
  await db.insert(circuitUnitAssignments).values(
    CAMIONES.map((c) => ({
      circuitId: IDS.circuito,
      unitId: c.id,
      carrierAccountId: IDS.carrier,
      validFrom: new Date(ahora.getTime() - 30 * 24 * 3_600_000),
    })),
  );

  await db.insert(devices).values(
    CAMIONES.map((c, i) => ({ id: APARATO(i), carrierAccountId: IDS.carrier, imei: c.imei, label: `TK-${c.label}` })),
  );
  await db.insert(deviceAssignments).values(
    CAMIONES.map((c, i) => ({
      unitId: c.id,
      deviceId: APARATO(i),
      validFrom: new Date(ahora.getTime() - 30 * 24 * 3_600_000),
    })),
  );

  /*
   * `--sin-salir`: asignados y ninguno al aire. Es una falla real del
   * servicio, y el reloj de cada parada tiene que correr desde la apertura.
   */
  if (opciones.sinSalir) {
    console.log("[escenario-torre] sembrado SIN SALIR: camiones asignados, ninguno al aire.");
    console.log(`[escenario-torre] torre:   http://localhost:3000/casa/transportista/circuitos/${IDS.circuito}`);
    console.log(`[escenario-torre] mira con:  JTEL_DEV_USER=${OPERADOR}`);
    return;
  }

  /* Dónde va cada uno ahora. Todos dentro del corredor: lo que los separa es la
     edad de su fix y su velocidad, que es exactamente lo que la torre lee. */
  const fix = (segundos: number) => new Date(ahora.getTime() - segundos * 1000);
  await db.insert(livePositions).values([
    { imei: "FIXTURE-TORRE-2120", carrierAccountId: IDS.carrier, deviceId: APARATO(0), latitude: LAT(3) + 0.003, longitude: LON, speed: 41.6, heading: 0, recordedAt: fix(9), collectedAt: ahora },
    { imei: "FIXTURE-TORRE-2126", carrierAccountId: IDS.carrier, deviceId: APARATO(1), latitude: LAT(2) + 0.002, longitude: LON, speed: 47.2, heading: 0, recordedAt: fix(14), collectedAt: ahora },
    { imei: "FIXTURE-TORRE-2101", carrierAccountId: IDS.carrier, deviceId: APARATO(2), latitude: LAT(4), longitude: LON, speed: 0, heading: 180, recordedAt: fix(21), collectedAt: ahora },
    // Once minutos: pasó el umbral de frescura (180 s) y no el de confianza (15 min) → SIN SEÑAL.
    { imei: "FIXTURE-TORRE-2109", carrierAccountId: IDS.carrier, deviceId: APARATO(3), latitude: LAT(2), longitude: LON, speed: 0, heading: 180, recordedAt: fix(11 * 60), collectedAt: ahora },
    // Corre y todavía no cruza ninguna parada con el detector: SIN DATOS por `sin_pasos`.
    { imei: "FIXTURE-TORRE-2115", carrierAccountId: IDS.carrier, deviceId: APARATO(4), latitude: LAT(0) + 0.001, longitude: LON, speed: 18.4, heading: 0, recordedAt: fix(7), collectedAt: ahora },
  ]);

  const pasos: Array<typeof circuitStopPasses.$inferInsert> = [];
  for (const v of versiones) {
    for (const [sentido, especiales, pareja] of [
      ["ida", CADENA_IDA, PAREJA_IDA],
      ["vuelta", CADENA_VUELTA, PAREJA_VUELTA],
    ] as const) {
      for (const [minutosAtras, label] of especiales[v.nombre] ?? pareja) {
        const desde = new Date(ahora.getTime() - minutosAtras * MIN);
        pasos.push({
          circuitId: IDS.circuito,
          stopId: v.stopId,
          stopVersionId: v.versionId,
          unitId: unidadPorLabel.get(label)!,
          sentido,
          pasoDesde: desde,
          pasoHasta: new Date(desde.getTime() + 18_000),
          huecoSegundos: 18,
          // La versión que corre el orquestador: la torre sólo lee la suya.
          detectorVersion: "orquestador-v1",
        });
      }
    }
  }
  if (opciones.jornada) {
    await sembrarJornada(db, ahora, versiones);
  } else {
    await db.insert(circuitStopPasses).values(pasos);
  }

  if (opciones.compartido) {
    await db.insert(units).values({ id: DE_OTRO.id, carrierAccountId: IDS.otroCarrier, label: DE_OTRO.label, active: true });
    await db.insert(circuitUnitAssignments).values({
      circuitId: IDS.circuito,
      unitId: DE_OTRO.id,
      carrierAccountId: IDS.otroCarrier,
      validFrom: new Date(ahora.getTime() - 24 * 3_600_000),
    });
  }

  if (opciones.asignar) {
    await db.insert(accounts).values({
      id: IDS.concesionVecina,
      type: "concesion",
      name: "Concesión vecina",
      slug: `${SLUG}-vecina`,
      isDemo: true,
    });
    await db.insert(concessionCarriers).values({ concessionAccountId: IDS.concesionVecina, carrierAccountId: IDS.carrier });
    await db.insert(circuits).values({
      id: IDS.circuitoVecino,
      concessionAccountId: IDS.concesionVecina,
      name: "Juárez–Aeropuerto",
      publicSlug: `${SLUG}-vecino`,
      serviceStartLocal: "05:30:00",
      serviceEndLocal: "22:00:00",
      timeZone: ZONA,
      active: true,
    });
    await db.insert(units).values(
      Object.values(PARA_ASIGNAR).map((u) => ({ id: u.id, carrierAccountId: IDS.carrier, label: u.label, active: true })),
    );
    await db.insert(circuitUnitAssignments).values([
      {
        circuitId: IDS.circuitoVecino,
        unitId: PARA_ASIGNAR.enOtro.id,
        carrierAccountId: IDS.carrier,
        validFrom: new Date(ahora.getTime() - 3 * 24 * 3_600_000),
        asignadaPor: OPERADOR,
      },
      {
        circuitId: IDS.circuito,
        unitId: PARA_ASIGNAR.yaCorrio.id,
        carrierAccountId: IDS.carrier,
        validFrom: new Date(ahora.getTime() - 9 * 24 * 3_600_000),
        validTo: new Date(ahora.getTime() - 2 * 24 * 3_600_000),
        motivo: "Entró a taller",
        asignadaPor: OPERADOR,
        cerradaPor: OPERADOR,
      },
    ]);
  }

  console.log(
    `[escenario-torre] sembrado · ${pasos.length} pasos · abre ${horaLocal(ahora, 60)}` +
      `${opciones.compartido ? " · COMPARTIDO con otro transportista (9.14)" : ""}`,
  );
  console.log(`[escenario-torre] cuarto:  http://localhost:3000/casa/transportista/circuitos`);
  console.log(`[escenario-torre] torre:   http://localhost:3000/casa/transportista/circuitos/${IDS.circuito}`);
  console.log(`[escenario-torre] mira con:  JTEL_DEV_USER=${OPERADOR}`);
  console.log("[escenario-torre] al terminar:  pnpm --filter @jtel/db escenario-torre --limpiar");
}

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");

const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
  confirmacion: iBase >= 0 ? args[iBase + 1] : undefined,
});
if (!veredicto.ok) {
  console.error(`\n  ✗ [escenario-torre] ${veredicto.motivo}\n`);
  process.exit(1);
}
console.log(
  `[escenario-torre] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}` +
    ` · distinta de: ${veredicto.comparadaCon.join(", ") || "(nada que comparar)"}`,
);

const db = createDb(process.env.DATABASE_URL_TEST!);
if (args.includes("--limpiar")) await limpiar(db);
else
  await sembrar(db, {
    compartido: args.includes("--compartido"),
    vacio: args.includes("--vacio"),
    asignar: args.includes("--asignar"),
    sinUnidades: args.includes("--sin-unidades"),
    sinSalir: args.includes("--sin-salir"),
    jornada: args.includes("--jornada"),
  });
process.exit(0);
