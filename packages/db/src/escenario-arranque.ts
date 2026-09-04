import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { eq, inArray } from "drizzle-orm";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import {
  accounts,
  circuitPaths,
  circuitStopVersions,
  circuitStops,
  circuitUnitAssignments,
  circuits,
  deviceAssignments,
  devices,
  livePositions,
  units,
} from "./schema/index.js";

/**
 * El escenario del circuito que todavía no arranca — la `0032`.
 *
 *   pnpm --filter @jtel/db escenario-arranque                 # arranca en 12 días
 *   pnpm --filter @jtel/db escenario-arranque --sin-fecha     # el ANTES: sin fecha
 *   pnpm --filter @jtel/db escenario-arranque --con-ensayo    # + un camión probando la ruta
 *   pnpm --filter @jtel/db escenario-arranque --horario 05:00-23:00
 *   pnpm --filter @jtel/db escenario-arranque --limpiar
 *
 * Existe para poder MIRAR las dos versiones de la misma pantalla, contra los
 * mismos datos: **una revisión que no puede enseñar el defecto vivo no prueba
 * que lo arregló.** `--sin-fecha` es exactamente el estado de hoy — un circuito
 * publicado semanas antes de su primer día — y sin él las capturas del después
 * no tendrían contra qué compararse.
 *
 * ## Por qué un escenario y no la calle
 *
 * Porque el arranque de un circuito real ocurre una vez, en una fecha que fija
 * un concesionario, y hasta entonces no hay ninguno en este estado. Esperar no
 * era una opción peor: no era una opción.
 *
 * ## Por qué esto no viola §D ni §E del Marco
 *
 * La prueba corta del §F es «¿esto va a producirle a alguien una afirmación que
 * el sistema no midió?». Aquí no hay receptor: vive en la rama desechable, lo
 * mira quien lo sembró, y se borra al terminar. Lo prohibido es sembrar
 * producción o dejar esto vivo donde un pasajero lo lea; lo primero lo cierra
 * `candado-desechable`, lo segundo `--limpiar`.
 *
 * ## Las tres unidades, y por qué son tres
 *
 * Son los tres estados en que está una flota antes de un arranque, y cada una
 * produce un renglón distinto en Operar:
 *
 *   A-01  fresca DENTRO del corredor   ← el camión del ENSAYO, sólo con --con-ensayo
 *   A-02  fresca a 9 km del trazado    ← el patio
 *   A-03  sin una sola posición        ← asignada y nada más
 *
 * **El ensayo es el que más prueba.** Con el circuito sin arrancar, ese camión
 * NO sale por el endpoint del pasajero aunque esté fresco y en ruta: publicarlo
 * convertiría una prueba de campo en un servicio, y a alguien parado en la
 * banqueta le diría que ya puede subirse.
 *
 * ## El horario, y por qué se puede abrir
 *
 * El circuito nace con el horario real del arranque —05:00 a 20:00— y **sin
 * frecuencia declarada**, que es el caso que va a salir.
 *
 * Para POR ARRANCAR el horario da igual: la fecha manda sobre el reloj, así que
 * el estado se alcanza a cualquier hora. Para el ANTES no — fuera de horario
 * tapa justo lo que se quiere enseñar—, y por eso existe `--horario`: la pareja
 * antes/después se siembra con el mismo horario abierto a la hora en que se
 * mira, y entonces lo único que cambia entre las dos capturas es la fecha.
 */

/* La misma carga que el resto de los guiones del paquete, más un candidato: esto
   se corre a menudo desde un worktree, donde la raíz del árbol no es la del repo
   y el `.env` no está ahí. */
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
const IDS = {
  concesion: "f2000000-0000-4000-8000-000000000001",
  carrier: "f2000000-0000-4000-8000-000000000002",
  circuito: "f2000000-0000-4000-8000-000000000003",
  unidadEnsayo: "f2000000-0000-4000-8000-000000000010",
  unidadPatio: "f2000000-0000-4000-8000-000000000011",
  unidadMuda: "f2000000-0000-4000-8000-000000000012",
  aparatoEnsayo: "f2000000-0000-4000-8000-000000000020",
  aparatoPatio: "f2000000-0000-4000-8000-000000000021",
} as const;

const SLUG = "escenario-arranque";
const IMEI_ENSAYO = "FIXTURE-ARRANQUE-ENSAYO";
const IMEI_PATIO = "FIXTURE-ARRANQUE-PATIO";

const LON = -106.45;
const TRAZADO: Array<[number, number]> = [
  [LON, 31.7],
  [LON, 31.72],
  [LON, 31.74],
];

const PARADAS = [
  { nombre: "Terminal Sur", lat: 31.7 },
  { nombre: "Mercado", lat: 31.709 },
  { nombre: "Hospital", lat: 31.718 },
  { nombre: "Plaza de Armas", lat: 31.727 },
  { nombre: "Terminal Norte", lat: 31.74 },
];

/** La fecha civil de Ciudad Juárez, más N días. Es la zona del circuito. */
function enDias(dias: number): string {
  const ahora = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Ciudad_Juarez",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
  const [y, m, d] = local.split("-").map(Number);
  const civil = new Date(Date.UTC(y!, m! - 1, d! + dias, 12));
  return civil.toISOString().slice(0, 10);
}

async function limpiar(db: ReturnType<typeof createDb>) {
  // El circuito cae por cascada: trazados, paradas, versiones y asignaciones.
  await db.delete(livePositions).where(inArray(livePositions.imei, [IMEI_ENSAYO, IMEI_PATIO]));
  await db.delete(circuits).where(eq(circuits.id, IDS.circuito));
  await db.delete(accounts).where(eq(accounts.id, IDS.concesion));
  // Unidades y aparatos cuelgan del carrier; borrarlo se los lleva.
  await db.delete(accounts).where(eq(accounts.id, IDS.carrier));
  console.log("[escenario-arranque] borrado.");
}

async function sembrar(
  db: ReturnType<typeof createDb>,
  opciones: { sinFecha: boolean; conEnsayo: boolean; horario: [string, string]; dias: number },
) {
  const ahora = new Date();
  const arrancaEl = opciones.sinFecha ? null : enDias(opciones.dias);

  await limpiar(db); // idempotente: re-sembrar no acumula

  await db.insert(accounts).values([
    {
      id: IDS.concesion,
      type: "concesion",
      name: "Concesión de escenario",
      slug: SLUG,
      isDemo: true,
    },
    {
      id: IDS.carrier,
      type: "carrier",
      name: "Transportista de escenario",
      slug: `${SLUG}-carrier`,
      isDemo: true,
    },
  ]);

  await db.insert(circuits).values({
    id: IDS.circuito,
    concessionAccountId: IDS.concesion,
    name: "Corredor de Escenario",
    publicSlug: SLUG,
    /*
     * SIN frecuencia declarada, a propósito: es el caso que va a salir en el
     * arranque real, y es el que tiene que leerse entero en la pantalla. Con
     * frecuencia, la frase se cierra en «cada N min» y el caso sin declarar
     * —que es el difícil— no se revisa.
     */
    declaredFrequencyMinutes: null,
    staleAfterSeconds: 180,
    arrivalRangeFloorSeconds: 180,
    corridorToleranceMeters: 150,
    serviceConfidenceMinutes: 15,
    avgSpeedKmh: 20.5,
    colorHex: "#5b3ea6",
    serviceLaunchDate: arrancaEl,
    serviceStartLocal: `${opciones.horario[0]}:00`,
    serviceEndLocal: `${opciones.horario[1]}:00`,
    timeZone: "America/Ciudad_Juarez",
    /* PUBLICADO. El escalón que esto prueba es «declarado y visible, con el
       servicio sin arrancar»: sin publicar sería el estado viejo, el invisible. */
    publishedAt: ahora,
    arrivalRangeEnabledAt: null,
  });

  await db.insert(circuitPaths).values({
    circuitId: IDS.circuito,
    sentido: "ida",
    coordinates: TRAZADO,
    pointCount: TRAZADO.length,
    lengthMeters: 4440,
    sourceFileName: "escenario-arranque (fixture)",
  });

  for (const [i, p] of PARADAS.entries()) {
    const stopId = `f2000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
    await db
      .insert(circuitStops)
      .values({ id: stopId, circuitId: IDS.circuito, qrSlug: `${SLUG}-p${i + 1}` });
    await db.insert(circuitStopVersions).values({
      stopId,
      name: p.nombre,
      orden: i + 1,
      sentido: "ida",
      latitude: p.lat,
      longitude: LON,
    });
  }

  await db.insert(units).values([
    { id: IDS.unidadEnsayo, carrierAccountId: IDS.carrier, label: "A-01" },
    { id: IDS.unidadPatio, carrierAccountId: IDS.carrier, label: "A-02" },
    { id: IDS.unidadMuda, carrierAccountId: IDS.carrier, label: "A-03" },
  ]);
  await db.insert(devices).values([
    { id: IDS.aparatoEnsayo, carrierAccountId: IDS.carrier, imei: IMEI_ENSAYO },
    { id: IDS.aparatoPatio, carrierAccountId: IDS.carrier, imei: IMEI_PATIO },
  ]);
  await db.insert(deviceAssignments).values([
    { unitId: IDS.unidadEnsayo, deviceId: IDS.aparatoEnsayo, validFrom: ahora },
    { unitId: IDS.unidadPatio, deviceId: IDS.aparatoPatio, validFrom: ahora },
  ]);
  await db.insert(circuitUnitAssignments).values([
    { circuitId: IDS.circuito, unitId: IDS.unidadEnsayo, carrierAccountId: IDS.carrier },
    { circuitId: IDS.circuito, unitId: IDS.unidadPatio, carrierAccountId: IDS.carrier },
    { circuitId: IDS.circuito, unitId: IDS.unidadMuda, carrierAccountId: IDS.carrier },
  ]);

  const posiciones: Array<typeof livePositions.$inferInsert> = [
    {
      imei: IMEI_PATIO,
      carrierAccountId: IDS.carrier,
      deviceId: IDS.aparatoPatio,
      unitId: IDS.unidadPatio,
      /* A ~9 km del trazado: el patio, el taller, otra ruta. Fresca y lejos. */
      latitude: 31.63,
      longitude: -106.445,
      heading: 0,
      recordedAt: ahora,
    },
  ];

  if (opciones.conEnsayo) {
    posiciones.push({
      imei: IMEI_ENSAYO,
      carrierAccountId: IDS.carrier,
      deviceId: IDS.aparatoEnsayo,
      unitId: IDS.unidadEnsayo,
      /* Sobre la avenida, entre Mercado y Hospital, con dato de este segundo. */
      latitude: 31.7135,
      longitude: LON,
      heading: 0, // al norte, que es el sentido «ida»
      recordedAt: ahora,
    });
  }

  await db.insert(livePositions).values(posiciones);

  console.log(
    `[escenario-arranque] sembrado · arranque=${arrancaEl ?? "SIN FECHA (el antes)"}` +
      `${opciones.conEnsayo ? " · con el camión del ensayo en el corredor" : ""}` +
      ` · horario ${opciones.horario[0]}–${opciones.horario[1]}`,
  );
  console.log(`[escenario-arranque] pasajero:   http://localhost:3100/c/${SLUG}`);
  console.log(`[escenario-arranque] circuito:   ${IDS.circuito}`);
  console.log("[escenario-arranque] al terminar:  pnpm --filter @jtel/db escenario-arranque --limpiar");
}

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");
const iDias = args.indexOf("--dias");
const iHorario = args.indexOf("--horario");

/* `05:00-20:00` es el horario real del primer arranque. `--horario` lo mueve
   para que el ANTES sea alcanzable a la hora en que uno mira. */
const horario: [string, string] =
  iHorario >= 0 && /^\d{2}:\d{2}-\d{2}:\d{2}$/.test(args[iHorario + 1] ?? "")
    ? (args[iHorario + 1]!.split("-") as [string, string])
    : ["05:00", "20:00"];

const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
  confirmacion: iBase >= 0 ? args[iBase + 1] : undefined,
});

if (!veredicto.ok) {
  console.error(`\n  ✗ [escenario-arranque] ${veredicto.motivo}\n`);
  process.exit(1);
}

console.log(
  `[escenario-arranque] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}` +
    ` · distinta de: ${veredicto.comparadaCon.join(", ") || "(nada que comparar)"}`,
);

const db = createDb(process.env.DATABASE_URL_TEST!);

if (args.includes("--limpiar")) await limpiar(db);
else
  await sembrar(db, {
    sinFecha: args.includes("--sin-fecha"),
    conEnsayo: args.includes("--con-ensayo"),
    horario,
    dias: iDias >= 0 ? Number(args[iDias + 1]) : 12,
  });

process.exit(0);
