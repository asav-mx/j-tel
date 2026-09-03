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
 * El escenario de las cuatro fugas del interruptor del rango — #366.
 *
 *   pnpm --filter @jtel/db escenario-permiso                    # rango apagado
 *   pnpm --filter @jtel/db escenario-permiso --con-rango        # rango prendido
 *   pnpm --filter @jtel/db escenario-permiso --por-horario      # ninguna fresca
 *   pnpm --filter @jtel/db escenario-permiso --sin-publicar     # vista previa
 *   pnpm --filter @jtel/db escenario-permiso --limpiar          # borrarlo
 *
 * `--sin-publicar` pide además `JTEL_VISTA_PREVIA=escenario-permiso` y un
 * servidor de desarrollo: la vista previa no existe en producción, a propósito.
 *
 * Existe para poder MIRAR en el navegador lo que ninguna prueba de datos ve: qué
 * dibuja la app del pasajero con el interruptor apagado y qué dibuja con él
 * prendido. Se siembra, se mira, se borra.
 *
 * ## Por qué vive en el repo
 *
 * Porque una verificación que nadie más puede reproducir no es una verificación.
 * La revisión del #366 —cuatro fugas, antes y después— se apoya entera en este
 * escenario, y sin él queda como una afirmación mía sobre unas capturas.
 *
 * ## Por qué un escenario y no la calle
 *
 * Dos razones, y la segunda es definitiva.
 *
 * La fuga de la frescura pide un camión que pierda señal **justo entre 3 y 15
 * minutos y estando dentro del corredor**. Eso no se agenda: hay que esperar a
 * que un aparato real falle el rato exacto.
 *
 * Y **Oasis–Centro no tiene unidades asignadas** —las dos de la prueba del
 * sábado se cerraron el 2 de septiembre de 2026—, así que no alcanza `en_vivo`
 * ni `por_horario` a ninguna hora del día. Esperar a la hora de turno no era una
 * opción peor: no era una opción.
 *
 * ## Por qué esto no viola §D ni §E del Marco
 *
 * La prueba corta del §F es «¿esto va a producirle a alguien una afirmación que
 * el sistema no midió?». Aquí no hay receptor: vive en la rama desechable, lo
 * mira quien lo sembró, y se borra al terminar. Lo prohibido es fabricar un dato
 * y presentarlo como observación del mundo real — sembrar producción, o dejar
 * esto vivo donde un pasajero lo lea. Lo primero lo cierra `candado-desechable`;
 * lo segundo, `--limpiar`.
 *
 * ## La geometría, y por qué está puesta así
 *
 * Una avenida recta de sur a norte. 0.01° de latitud son ~1 110 m.
 *
 *   av 0      Terminal Sur      31.7000
 *   av ~944   [FRESCA]                     ← recordedAt = ahora
 *   av ~1000  Mercado           31.7090
 *   av ~1800  [VIEJA]                      ← recordedAt = ahora − 6 min
 *   av ~2000  Hospital          31.7180
 *   av ~3000  Plaza de Armas    31.7270
 *   av ~4440  Terminal Norte    31.7400
 *
 * **La vieja va DELANTE de la fresca y más cerca de Hospital y de Plaza.** Ese es
 * el corazón del montaje: con el código de antes, esas dos paradas leían su
 * tiempo del camión que la propia app pinta gris con «hace 6 min», y Hospital
 * —a 200 m de la vieja— decía «llegando» mientras el titular decía «0–7 min».
 *
 * Si la vieja fuera detrás de la fresca, el arreglo no cambiaría nada visible y
 * la revisión pasaría en vacío. La posición relativa **es** la prueba.
 */

/* La misma carga que el resto de los guiones del paquete, más un candidato: esto
   se corre a menudo desde un worktree, donde la raíz del árbol no es la del repo
   y el `.env` no está ahí. `--git-common-dir` apunta al `.git` del checkout
   principal, y su padre es donde vive. */
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
  concesion: "f1000000-0000-4000-8000-000000000001",
  carrier: "f1000000-0000-4000-8000-000000000002",
  circuito: "f1000000-0000-4000-8000-000000000003",
  unidadFresca: "f1000000-0000-4000-8000-000000000010",
  unidadVieja: "f1000000-0000-4000-8000-000000000011",
  aparatoFresco: "f1000000-0000-4000-8000-000000000020",
  aparatoViejo: "f1000000-0000-4000-8000-000000000021",
} as const;

const SLUG = "escenario-permiso";
const IMEI_FRESCO = "FIXTURE-PERMISO-FRESCA";
const IMEI_VIEJO = "FIXTURE-PERMISO-VIEJA";

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

async function limpiar(db: ReturnType<typeof createDb>) {
  // El circuito cae por cascada: trazados, paradas, versiones y asignaciones.
  await db.delete(livePositions).where(inArray(livePositions.imei, [IMEI_FRESCO, IMEI_VIEJO]));
  await db.delete(circuits).where(eq(circuits.id, IDS.circuito));
  await db.delete(accounts).where(eq(accounts.id, IDS.concesion));
  // Unidades y aparatos cuelgan del carrier; borrarlo se los lleva.
  await db.delete(accounts).where(eq(accounts.id, IDS.carrier));
  console.log("[escenario-permiso] borrado.");
}

async function sembrar(
  db: ReturnType<typeof createDb>,
  conRango: boolean,
  porHorario: boolean,
  sinPublicar: boolean,
) {
  const ahora = new Date();

  await limpiar(db); // idempotente: re-sembrar no acumula

  await db.insert(accounts).values([
    { id: IDS.concesion, type: "concesion", name: "Concesión de escenario", slug: SLUG, isDemo: true },
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
    name: "Avenida de Escenario",
    publicSlug: SLUG,
    declaredFrequencyMinutes: 20,
    staleAfterSeconds: 180,
    arrivalRangeFloorSeconds: 180,
    corridorToleranceMeters: 150,
    serviceConfidenceMinutes: 15,
    avgSpeedKmh: 20.5,
    colorHex: "#5b3ea6",
    /* Abierto siempre: el escenario tiene que poder mirarse a cualquier hora, y
       el horario no es lo que se está probando. */
    serviceStartLocal: "00:00:00",
    serviceEndLocal: "23:59:00",
    timeZone: "America/Ciudad_Juarez",
    /*
     * `--sin-publicar` deja el circuito como lo que la app llama VISTA PREVIA:
     * existe, tiene trazado y unidades, y para el pasajero no existe. Es el
     * único estado donde se dibuja la franja amarilla, así que es el único
     * desde el cual se puede revisar que la franja no le coma el borde a la
     * chapa. Sin esto, esa comprobación depende de que alguien tenga a mano un
     * circuito a medio armar.
     */
    publishedAt: sinPublicar ? null : ahora,
    arrivalRangeEnabledAt: conRango ? ahora : null,
  });

  await db.insert(circuitPaths).values({
    circuitId: IDS.circuito,
    sentido: "ida",
    coordinates: TRAZADO,
    pointCount: TRAZADO.length,
    lengthMeters: 4440,
    sourceFileName: "escenario-permiso (fixture)",
  });

  for (const [i, p] of PARADAS.entries()) {
    const stopId = `f1000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
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
    { id: IDS.unidadFresca, carrierAccountId: IDS.carrier, label: "E-01" },
    { id: IDS.unidadVieja, carrierAccountId: IDS.carrier, label: "E-02" },
  ]);
  await db.insert(devices).values([
    { id: IDS.aparatoFresco, carrierAccountId: IDS.carrier, imei: IMEI_FRESCO },
    { id: IDS.aparatoViejo, carrierAccountId: IDS.carrier, imei: IMEI_VIEJO },
  ]);
  await db.insert(deviceAssignments).values([
    { unitId: IDS.unidadFresca, deviceId: IDS.aparatoFresco, validFrom: ahora },
    { unitId: IDS.unidadVieja, deviceId: IDS.aparatoViejo, validFrom: ahora },
  ]);
  await db.insert(circuitUnitAssignments).values([
    { circuitId: IDS.circuito, unitId: IDS.unidadFresca, carrierAccountId: IDS.carrier },
    { circuitId: IDS.circuito, unitId: IDS.unidadVieja, carrierAccountId: IDS.carrier },
  ]);

  await db.insert(livePositions).values([
    {
      imei: IMEI_FRESCO,
      carrierAccountId: IDS.carrier,
      deviceId: IDS.aparatoFresco,
      unitId: IDS.unidadFresca,
      latitude: 31.7085,
      longitude: LON,
      heading: 0, // al norte, que es el sentido «ida»
      /* En `--por-horario` ésta también envejece. Con NINGUNA fresca y las dos
         todavía dentro de la ventana de confianza, la escalera cae al tercer
         peldaño — donde vive la cuarta fuga, la promesa en futuro. */
      recordedAt: porHorario ? new Date(ahora.getTime() - 5 * 60_000) : ahora,
    },
    {
      imei: IMEI_VIEJO,
      carrierAccountId: IDS.carrier,
      deviceId: IDS.aparatoViejo,
      unitId: IDS.unidadVieja,
      latitude: 31.7162,
      longitude: LON,
      heading: 0,
      recordedAt: new Date(ahora.getTime() - 6 * 60_000),
    },
  ]);

  console.log(
    `[escenario-permiso] sembrado · rango=${conRango ? "PRENDIDO" : "apagado"}` +
      `${porHorario ? " · las dos unidades viejas (POR HORARIO)" : ""}`,
  );
  console.log(`[escenario-permiso] http://localhost:3100/c/${SLUG}`);
  console.log("[escenario-permiso] la VIEJA va delante y más cerca de Hospital (200 m) y Plaza.");
  console.log("[escenario-permiso] al terminar:  pnpm --filter @jtel/db escenario-permiso --limpiar");
}

const args = process.argv.slice(2);
const iBase = args.indexOf("--base");

const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
  confirmacion: iBase >= 0 ? args[iBase + 1] : undefined,
});

if (!veredicto.ok) {
  console.error(`\n  ✗ [escenario-permiso] ${veredicto.motivo}\n`);
  process.exit(1);
}

console.log(
  `[escenario-permiso] destino: ${veredicto.identidad.host}/${veredicto.identidad.base}` +
    ` · distinta de: ${veredicto.comparadaCon.join(", ") || "(nada que comparar)"}`,
);

const db = createDb(process.env.DATABASE_URL_TEST!);

if (args.includes("--limpiar")) await limpiar(db);
else
  await sembrar(
    db,
    args.includes("--con-rango"),
    args.includes("--por-horario"),
    args.includes("--sin-publicar"),
  );

process.exit(0);
