import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { inArray } from "drizzle-orm";
import { addDaysIso, instanteZonificado, localDateIso } from "@jtel/domain";
import { conexionesDelAmbiente, revisarDesechable } from "./candado-desechable.js";
import { createDb } from "./index.js";
import {
  accounts,
  carrierAportaciones,
  complianceFactHistory,
  complianceFacts,
  evidencePoints,
  geofences,
  ledgerEntries,
  plants,
  routeShifts,
  routes,
  serviceContracts,
  serviceOccurrences,
  serviceProfileUnits,
  serviceProfiles,
  shifts,
  trips,
  units,
  userMemberships,
} from "./schema/index.js";

/**
 * El escenario de Vernier V1 — Servicios especiales y su acta
 * (`docs/Ficha-Construccion-Vernier-V1.md`).
 *
 *   pnpm --filter @jtel/db escenario-vernier             # siembra
 *   pnpm --filter @jtel/db escenario-vernier --limpiar   # borra
 *
 * Se entra con `JTEL_DEV_USER=escenario_vernier`, que ve tres cuentas:
 *
 *   escenario-vernier       dos contratos, tres turnos, un hecho de cada forma
 *                           que el motor produce (ver OCURRENCIAS abajo)
 *   escenario-vernier-uno   un solo contrato: la fila de contratos no existe
 *   escenario-vernier-solo  sin contrato: el cuarto no existe, ni su pestaña
 *
 * **Cada hecho tiene la forma que el motor le da** —status, timing, paso
 * `decision` del ledger escrito justo después del sello, puntos de evidencia
 * del viaje—, porque la pantalla lee esas formas y nada más. Los nombres son
 * de ejemplo; ningún número de aquí es una medición.
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

const SLUG = "escenario-vernier";
const ZONA = "America/Ciudad_Juarez";
const id = (n: number) => `f5000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const CARRIER = id(1);
const CARRIER_UNO = id(2);
const CARRIER_SOLO = id(3);
const CLIENTE_N = id(4);
const CLIENTE_O = id(5);
const USUARIO = "escenario_vernier";
const MIN = 60_000;

const POLITICA = {
  toleranceMinutes: 5,
  arrivalAnticipationMinutes: 15,
  verificationGraceMinutes: 15,
  routeStrictness: "destino_only",
  timeZone: ZONA,
} as const;

type LatLng = [number, number];
const PLANTA_N: LatLng[] = [
  [31.74, -106.395],
  [31.74, -106.388],
  [31.745, -106.388],
  [31.745, -106.395],
];
const PLANTA_O: LatLng[] = [
  [31.705, -106.33],
  [31.705, -106.322],
  [31.71, -106.322],
  [31.71, -106.33],
];
const CAMINO_N: LatLng[] = [[31.701, -106.473], [31.715, -106.455], [31.728, -106.43], [31.738, -106.405], [31.7425, -106.3915]];
const CAMINO_O: LatLng[] = [[31.69, -106.43], [31.695, -106.39], [31.702, -106.35], [31.7075, -106.326]];

/** Un punto por minuto a lo largo de un camino, repartido por distancia. */
function trayecto(camino: LatLng[], desde: number, minutos: number) {
  const tramos = camino.slice(1).map((b, i) => Math.hypot(b[0] - camino[i]![0], b[1] - camino[i]![1]));
  const total = tramos.reduce((a, b) => a + b, 0);
  return Array.from({ length: minutos + 1 }, (_, m) => {
    let falta = (m / minutos) * total;
    let i = 0;
    while (i < tramos.length - 1 && falta > tramos[i]!) falta -= tramos[i++]!;
    const f = tramos[i] ? falta / tramos[i]! : 0;
    const a = camino[i]!;
    const b = camino[i + 1]!;
    return { at: desde + m * MIN, lat: a[0] + f * (b[0] - a[0]), lng: a[1] + f * (b[1] - a[1]), speed: 42 };
  });
}

type Traza = "normal" | "con_hueco" | "con_salto";
type Espec = {
  n: number;
  /** Días antes de hoy. */
  dias: number;
  contrato: "N" | "O" | "UNO";
  ruta: string;
  turno: "T1" | "T2" | "T3";
  veredicto: "cumplido" | "pendiente_evidencia" | "no_cumplido";
  timing?: "temprano" | "a_tiempo" | "tarde";
  /** Minutos de la llegada respecto de la llegada exigida (cumplidos). */
  llegada?: number;
  unidad?: string;
  pasos?: unknown[] | null;
  traza?: Traza;
  excusable?: string;
  resellado?: boolean;
  aportacion?: boolean;
};

const DECISION = (reason: string, result: string, extra: Record<string, unknown> = {}) => ({
  step: "decision",
  result,
  details: { reason, ...extra },
});
const COBERTURA = (ok: boolean, pct: number, hueco: number) => ({
  step: "cobertura_evidencia",
  result: ok ? "suficiente" : "insuficiente",
  details: { coveragePct: pct, maxGapMinutes: hueco, minCoveragePct: 80, maxGapMinutesAllowed: 10 },
});
const CUMPLE = [COBERTURA(true, 97.4, 3.1), { step: "decision", result: "cumplido", details: {} }];

/**
 * Una ocurrencia por cada forma que el motor produce. Los turnos: T1 llega a
 * las 06:45, T2 a las 14:45, T3 a las 22:45; tolerancia de 5 min.
 */
const OCURRENCIAS: Espec[] = [
  // Hoy
  { n: 10, dias: 0, contrato: "N", ruta: "R-01", turno: "T1", veredicto: "cumplido", timing: "a_tiempo", llegada: 2, unidad: "2115", pasos: CUMPLE, traza: "normal" },
  { n: 11, dias: 0, contrato: "N", ruta: "R-07", turno: "T1", veredicto: "pendiente_evidencia", pasos: [COBERTURA(true, 92, 4), DECISION("llegada_sin_atribucion", "pendiente_evidencia")] },
  // Ayer
  { n: 20, dias: 1, contrato: "N", ruta: "R-04", turno: "T1", veredicto: "cumplido", timing: "tarde", llegada: 27, unidad: "2120", pasos: CUMPLE, traza: "con_hueco", aportacion: true },
  { n: 21, dias: 1, contrato: "N", ruta: "R-02", turno: "T1", veredicto: "pendiente_evidencia", pasos: [COBERTURA(false, 71.2, 30), ] },
  { n: 22, dias: 1, contrato: "N", ruta: "R-03", turno: "T1", veredicto: "cumplido", timing: "temprano", llegada: -22, unidad: "2118", pasos: CUMPLE, traza: "con_salto" },
  { n: 23, dias: 1, contrato: "N", ruta: "R-09", turno: "T2", veredicto: "pendiente_evidencia", pasos: [{ step: "evidencia", result: "indisponible" }] },
  { n: 24, dias: 1, contrato: "O", ruta: "R-22", turno: "T2", veredicto: "no_cumplido", pasos: [COBERTURA(true, 95, 2), DECISION("ninguna_unidad_sirvio", "no_cumplido")] },
  { n: 25, dias: 1, contrato: "O", ruta: "R-21", turno: "T1", veredicto: "cumplido", timing: "a_tiempo", llegada: -3, unidad: "2117", pasos: CUMPLE, traza: "normal", resellado: true },
  { n: 26, dias: 1, contrato: "N", ruta: "R-12", turno: "T3", veredicto: "cumplido", timing: "tarde", llegada: 9, unidad: "2126", pasos: CUMPLE, excusable: "lluvia_nieve", traza: "normal" },
  // Hace dos y tres días
  { n: 30, dias: 2, contrato: "N", ruta: "R-11", turno: "T2", veredicto: "no_cumplido", pasos: [COBERTURA(true, 96, 2), DECISION("ninguna_unidad_coincidio_ruta", "no_cumplido")] },
  { n: 31, dias: 2, contrato: "N", ruta: "R-06", turno: "T2", veredicto: "pendiente_evidencia", pasos: [COBERTURA(true, 90, 5), DECISION("observacion_insuficiente", "pendiente_evidencia", { earliestObservedFraction: 0.34, originToleranceFraction: 0.15, poblacion: "viaje" })] },
  { n: 32, dias: 3, contrato: "N", ruta: "R-08", turno: "T3", veredicto: "pendiente_evidencia", pasos: null },
  { n: 33, dias: 3, contrato: "O", ruta: "R-21", turno: "T1", veredicto: "cumplido", timing: "a_tiempo", llegada: 1, unidad: "2117", pasos: CUMPLE, traza: "normal" },
  // Más atrás: entran con «Este mes» y no con «Esta semana» según el día
  { n: 40, dias: 9, contrato: "N", ruta: "R-10", turno: "T3", veredicto: "cumplido", timing: "a_tiempo", llegada: 0, unidad: "2115", pasos: CUMPLE, traza: "normal" },
  { n: 41, dias: 12, contrato: "N", ruta: "R-07", turno: "T1", veredicto: "pendiente_evidencia", pasos: [COBERTURA(true, 93, 3), DECISION("llegada_sin_atribucion", "pendiente_evidencia")] },
  // La cuenta de un solo contrato
  { n: 50, dias: 1, contrato: "UNO", ruta: "R-31", turno: "T1", veredicto: "cumplido", timing: "a_tiempo", llegada: 2, unidad: "3101", pasos: CUMPLE, traza: "normal" },
  { n: 51, dias: 1, contrato: "UNO", ruta: "R-32", turno: "T2", veredicto: "pendiente_evidencia", pasos: [COBERTURA(true, 92, 4), DECISION("llegada_sin_atribucion", "pendiente_evidencia")] },
];

const HORA_DEL_TURNO = { T1: "06:45", T2: "14:45", T3: "22:45" } as const;

async function limpiar(db: ReturnType<typeof createDb>) {
  // La historia de sellos no tiene llave hacia la ocurrencia: no se va sola con la cascada.
  await db
    .delete(complianceFactHistory)
    .where(inArray(complianceFactHistory.serviceOccurrenceId, OCURRENCIAS.map((e) => id(1000 + e.n))));
  await db.delete(accounts).where(inArray(accounts.id, [CARRIER, CARRIER_UNO, CARRIER_SOLO, CLIENTE_N, CLIENTE_O]));
  console.log(`[${SLUG}] borrado.`);
}

async function sembrar(db: ReturnType<typeof createDb>) {
  await limpiar(db);
  const ahora = Date.now();
  const hoy = localDateIso(new Date(ahora), ZONA);
  const instante = (dia: string, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return instanteZonificado(dia, h! * 60 + m!, ZONA).getTime();
  };

  await db.insert(accounts).values([
    { id: CARRIER, type: "carrier", name: "Escenario Vernier", slug: SLUG },
    { id: CARRIER_UNO, type: "carrier", name: "Escenario Vernier · un contrato", slug: `${SLUG}-uno` },
    { id: CARRIER_SOLO, type: "carrier", name: "Escenario Vernier · sin contrato", slug: `${SLUG}-solo` },
    { id: CLIENTE_N, type: "client", name: "Cliente Norte del escenario", slug: `${SLUG}-cliente-n` },
    { id: CLIENTE_O, type: "client", name: "Cliente Oriente del escenario", slug: `${SLUG}-cliente-o` },
  ]);
  await db.insert(userMemberships).values(
    [CARRIER, CARRIER_UNO, CARRIER_SOLO].map((accountId) => ({
      accountId,
      clerkUserId: USUARIO,
      role: "admin",
      scopeType: "account" as const,
    })),
  );

  const etiquetas = ["2115", "2117", "2118", "2120", "2126"];
  await db.insert(units).values([
    ...etiquetas.map((label, i) => ({ id: id(100 + i), carrierAccountId: CARRIER, label })),
    { id: id(150), carrierAccountId: CARRIER_UNO, label: "3101" },
  ]);
  const unidad = (label: string) => (label === "3101" ? id(150) : id(100 + etiquetas.indexOf(label)));

  const poligono = (p: LatLng[]) => p.map(([lat, lng]) => ({ lat, lng }));
  await db.insert(plants).values([
    { id: id(201), clientAccountId: CLIENTE_N, name: "Planta Norte (ejemplo)", code: "ESC-VER-N" },
    { id: id(202), clientAccountId: CLIENTE_O, name: "Planta Oriente (ejemplo)", code: "ESC-VER-O" },
  ]);
  await db.insert(geofences).values([
    { id: id(211), ownerType: "plant", ownerPlantId: id(201), role: "destino", name: "Planta Norte (ejemplo)", polygon: poligono(PLANTA_N) },
    { id: id(212), ownerType: "plant", ownerPlantId: id(202), role: "destino", name: "Planta Oriente (ejemplo)", polygon: poligono(PLANTA_O) },
  ]);
  const CONTRATO = { N: id(221), O: id(222), UNO: id(223) } as const;
  await db.insert(serviceContracts).values([
    { id: CONTRATO.N, carrierAccountId: CARRIER, clientAccountId: CLIENTE_N, plantId: id(201), name: "Contrato Norte", status: "active", validFrom: "2026-01-01", validTo: "2027-12-31", policy: POLITICA as never },
    { id: CONTRATO.O, carrierAccountId: CARRIER, clientAccountId: CLIENTE_O, plantId: id(202), name: "Contrato Oriente", status: "active", validFrom: "2026-01-01", validTo: "2027-12-31", policy: POLITICA as never },
    { id: CONTRATO.UNO, carrierAccountId: CARRIER_UNO, clientAccountId: CLIENTE_N, plantId: id(201), name: "Contrato único", status: "active", validFrom: "2026-01-01", validTo: "2027-12-31", policy: POLITICA as never },
  ]);
  const cliente = { N: CLIENTE_N, O: CLIENTE_O, UNO: CLIENTE_N } as const;
  const planta = { N: id(201), O: id(202), UNO: id(201) } as const;
  const destino = { N: id(211), O: id(212), UNO: id(211) } as const;
  const camino = { N: CAMINO_N, O: CAMINO_O, UNO: CAMINO_N } as const;

  // Turnos por cliente: el mismo nombre en dos clientes son dos turnos.
  const turnos = new Map<string, string>();
  let siguiente = 300;
  for (const c of ["N", "O"] as const) {
    for (const t of ["T1", "T2", "T3"] as const) {
      const sid = id(siguiente++);
      // El turno empieza 15 min después de la llegada exigida (la anticipación de la política).
      const [h, m] = HORA_DEL_TURNO[t].split(":").map(Number);
      const minutos = h! * 60 + m! + POLITICA.arrivalAnticipationMinutes;
      const inicio = `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
      await db.insert(shifts).values({ id: sid, clientAccountId: cliente[c], plantId: planta[c], name: t, startTime: inicio });
      turnos.set(`${c}|${t}`, sid);
    }
  }

  let n = 400;
  const perfiles = new Map<string, string>();
  for (const e of OCURRENCIAS) {
    const c = e.contrato === "UNO" ? "N" : e.contrato;
    const clave = `${e.contrato}|${e.ruta}|${e.turno}`;
    if (!perfiles.has(clave)) {
      const rid = id(n++);
      const rsid = id(n++);
      const pid = id(n++);
      await db.insert(routes).values({ id: rid, clientAccountId: cliente[e.contrato], plantId: planta[e.contrato], name: e.ruta });
      await db.insert(routeShifts).values({ id: rsid, clientAccountId: cliente[e.contrato], plantId: planta[e.contrato], routeId: rid, shiftId: turnos.get(`${c}|${e.turno}`)! });
      await db.insert(serviceProfiles).values({
        id: pid,
        contractId: CONTRATO[e.contrato],
        routeShiftId: rsid,
        geofenceId: destino[e.contrato],
        name: `${e.ruta} · ${e.turno}`,
        code: `ESC-VER-${e.contrato}-${e.ruta}-${e.turno}`,
      });
      const posibles = e.contrato === "UNO" ? ["3101"] : e.contrato === "O" ? ["2117", "2118"] : ["2115", "2118", "2120", "2126"];
      await db.insert(serviceProfileUnits).values(posibles.map((u) => ({ serviceProfileId: pid, unitId: unidad(u) })));
      perfiles.set(clave, `${pid}|${rsid}`);
    }
    const [pid, rsid] = perfiles.get(clave)!.split("|") as [string, string];

    const dia = addDaysIso(hoy, -e.dias);
    const exigida = instante(dia, HORA_DEL_TURNO[e.turno]);
    // Hoy sólo se siembra lo que ya se habría sellado: no se finge un sello futuro.
    const sello = exigida + (POLITICA.toleranceMinutes + POLITICA.verificationGraceMinutes) * MIN + 67_000;
    if (sello > ahora) continue;

    const oid = id(1000 + e.n);
    const tid = id(2000 + e.n);
    await db.insert(serviceOccurrences).values({
      id: oid,
      serviceProfileId: pid,
      contractId: CONTRATO[e.contrato],
      routeShiftId: rsid,
      serviceDate: dia,
      expectedDeadline: new Date(exigida),
      expectedGeofenceId: destino[e.contrato],
    });
    await db.insert(trips).values({
      id: tid,
      serviceOccurrenceId: oid,
      evidenceWindowStart: new Date(exigida - 75 * MIN),
      evidenceWindowEnd: new Date(exigida + 30 * MIN),
      evidenceStatus: e.pasos?.[0] && (e.pasos[0] as { result?: string }).result === "indisponible" ? "indisponible" : "disponible",
    });

    const llegada = e.llegada !== undefined ? exigida + e.llegada * MIN + 41_000 : null;
    const observada = e.unidad ? unidad(e.unidad) : null;
    const hecho = {
      serviceOccurrenceId: oid,
      tripId: tid,
      expectedDeadline: new Date(exigida),
      expectedGeofenceId: destino[e.contrato],
      observedUnitId: observada,
      observedArrivalAt: llegada ? new Date(llegada) : null,
      status: e.veredicto,
      timing: e.timing ?? null,
      lateExcusable: Boolean(e.excusable),
      excusableReason: e.excusable ?? null,
      routeStrictnessApplied: "destino_only" as const,
      contractPolicySnapshot: POLITICA as never,
      materializedAt: new Date(sello),
    };

    if (e.resellado) {
      // El sello anterior: un pendiente que el re-sello reemplazó dos horas después.
      await db.insert(complianceFactHistory).values({
        serviceOccurrenceId: oid,
        status: "pendiente_evidencia",
        timing: null,
        factSnapshot: { ...hecho, status: "pendiente_evidencia", observedUnitId: null, observedArrivalAt: null, timing: null },
        actorKind: "jstaff",
        actorId: "escenario",
        replacedAt: new Date(sello + 2 * 60 * MIN),
      });
      hecho.materializedAt = new Date(sello + 2 * 60 * MIN);
    }
    const [f] = await db.insert(complianceFacts).values(hecho).returning({ id: complianceFacts.id, at: complianceFacts.materializedAt });

    if (e.pasos) {
      await db.insert(ledgerEntries).values({
        tripId: tid,
        serviceOccurrenceId: oid,
        actorKind: "system",
        action: "verificacion_automatica",
        steps: [{ step: "inicio", result: "evaluando" }, ...e.pasos] as never,
        createdAt: new Date(f!.at.getTime() + 180),
      });
    }

    if (observada && e.traza && llegada) {
      const salida = llegada - 58 * MIN;
      let puntos = trayecto(camino[e.contrato], salida, 58);
      // Después de la llegada la unidad sigue transmitiendo: el acta no lo dibuja.
      puntos.push(...Array.from({ length: 10 }, (_, i) => ({ ...puntos[puntos.length - 1]!, at: llegada + (i + 1) * MIN, speed: 0 })));
      if (e.traza === "con_hueco") puntos = puntos.filter((p) => p.at < salida + 18 * MIN || p.at > salida + 39 * MIN);
      if (e.traza === "con_salto") {
        const k = 25;
        puntos[k] = { ...puntos[k]!, lat: puntos[k]!.lat + 0.3, lng: puntos[k]!.lng - 0.2 };
      }
      await db.insert(evidencePoints).values(
        puntos.map((p) => ({
          tripId: tid,
          unitId: observada,
          imei: `FIXTURE-VERNIER-${e.unidad}`,
          latitude: p.lat,
          longitude: p.lng,
          speed: p.speed,
          recordedAt: new Date(p.at),
        })),
      );
    }

    if (e.aportacion) {
      await db.insert(carrierAportaciones).values({
        serviceOccurrenceId: oid,
        carrierAccountId: CARRIER,
        motivo: "obstruccion",
        nota: "Cierre de un carril en el camino; el chofer tomó el desvío señalado.",
        estado: "enviada",
        actorKind: "carrier",
        actorId: USUARIO,
        createdAt: new Date(sello + 3 * 60 * MIN),
      });
    }
  }

  console.log(`[${SLUG}] sembrado a las ${new Date(ahora).toISOString()} · hoy = ${hoy}`);
  console.log(`[${SLUG}] usuario: JTEL_DEV_USER=${USUARIO} · cuentas ${SLUG}, ${SLUG}-uno y ${SLUG}-solo`);
  console.log(`[${SLUG}] cuarto: /casa/transportista/servicios-especiales?account=${SLUG}`);
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
