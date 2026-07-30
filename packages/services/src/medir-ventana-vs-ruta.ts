/**
 * Medición de solo-lectura — ¿la ventana de observación del contrato alcanza
 * a cubrir la ruta completa, o el KML tiene un tramo que estructuralmente
 * nunca puede tener evidencia?
 *
 * Origen: en Huertas-B se encontró que el 96% de los puntos GPS caen a
 * <150 m del trazado (mediana 60 m) — el camión maneja bien — pero los
 * primeros 9.5 km del KML (45% del trazado, bloque contiguo) no tienen NI UN
 * punto porque la ventana de observación abre después de que la ruta ya
 * arrancó. El match se calcula contra el KML completo, así que esa ruta no
 * puede pasar de ~55% aunque se maneje perfecto. Eso es un problema del
 * MOTOR (ventana mal dimensionada), no de mapas.
 *
 * NO ESCRIBE NADA en la base, no toca el motor de producción, no toca
 * hechos ni el cron. Solo mide, para las dos plantas (Tecma 47 y Campus
 * Santos Dumont).
 *
 * Método por ruta (2 ocurrencias representativas por ruta, las más
 * tempranas con viaje):
 *   1. Ventana de observación = computeEvidenceWindow(expectedDeadline, policy)
 *      — ancho fijo por contrato (margenAntes + gracia + margenDespués).
 *   2. Búsqueda AMPLIA de telemetría (deadline-4h a deadline+3h, sin el
 *      recorte de la ventana) para todos los dispositivos candidatos del
 *      carrier — así se puede ver qué pasó ANTES de que abriera la ventana.
 *   3. Para cada dispositivo, cuántos waypoints del KML tienen un punto a
 *      ≤120 m en la búsqueda amplia (mismo umbral que kmlCorridorMeters por
 *      omisión) — el dispositivo con más waypoints cubiertos es "la mejor
 *      candidata", sea o no la unidad que terminó sellada.
 *   4. De esa candidata: duración real = último punto "en ruta" menos
 *      primero. Match máximo alcanzable = fracción de waypoints cuyo punto
 *      más cercano cae DENTRO de la ventana configurada (no en la búsqueda
 *      amplia completa).
 *
 * Usa haversineKm de @jtel/verification — la misma función que usa el
 * motor real para medir distancias, no una reimplementación paralela.
 *
 *   pnpm --filter @jtel/services exec tsx src/medir-ventana-vs-ruta.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { createDb, createRepositories, clasificarDiferencia, type Database, type Repositories } from "@jtel/db";
import { JTTEL_TZ, computeEvidenceWindow, type ContractPolicy } from "@jtel/domain";
import { haversineKm } from "@jtel/verification";
import { cargarTurnoYPlanta } from "./reverificacion-zona-motor.js";

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = resolve(__dirname, "../../../docs/correcciones");
const REPORTE_PATH = resolve(DOCS_DIR, "2026-07-30-ventana-vs-ruta.md");

const CONTRATOS = [
  { id: "7d668ed5-fbb4-4fc1-865f-8db141e9fdce", nombre: "Tecma 47" },
  { id: "74e4153e-0ebb-459d-930f-80d1d4de49fb", nombre: "Campus Santos Dumont" },
];

const UMBRAL_CORREDOR_KM = 0.12; // mismo default que kmlCorridorMeters (120 m)
const BUSQUEDA_HORAS_ANTES = 4;
const BUSQUEDA_HORAS_DESPUES = 3;
const REPRESENTANTES_POR_RUTA = 2;

type FilaOcc = {
  occurrenceId: string;
  serviceDate: string;
  expectedDeadline: Date;
  contractId: string;
  contrato: string;
  routeId: string;
  ruta: string;
  turno: string;
  routeShiftId: string;
  status: string | null;
};

async function cargarOcurrencias(db: Database): Promise<FilaOcc[]> {
  const rows = await db.execute(sql`
    SELECT o.id AS occurrence_id, o.service_date::text AS service_date, o.expected_deadline,
           ct.id AS contract_id, ct.name AS contrato,
           r.id AS route_id, r.name AS ruta, sh.name AS turno, rs.id AS route_shift_id,
           cf.status
      FROM service_occurrences o
      JOIN service_profiles p ON p.id = o.service_profile_id
      JOIN service_contracts ct ON ct.id = p.contract_id
      JOIN route_shifts rs ON rs.id = p.route_shift_id
      JOIN routes r ON r.id = rs.route_id
      JOIN shifts sh ON sh.id = rs.shift_id
      JOIN trips t ON t.service_occurrence_id = o.id
      LEFT JOIN compliance_facts cf ON cf.service_occurrence_id = o.id
     WHERE ct.id IN (${CONTRATOS[0]!.id}, ${CONTRATOS[1]!.id})
     ORDER BY rs.id, o.service_date
  `);
  return (rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    occurrenceId: String(r.occurrence_id),
    serviceDate: String(r.service_date),
    expectedDeadline: new Date(r.expected_deadline as string),
    contractId: String(r.contract_id),
    contrato: String(r.contrato),
    routeId: String(r.route_id),
    ruta: String(r.ruta),
    turno: String(r.turno),
    routeShiftId: String(r.route_shift_id),
    status: r.status ? String(r.status) : null,
  }));
}

type MedicionOcurrencia = {
  ventanaMin: number;
  duracionRealMin: number | null;
  kmlLargoKm: number;
  matchMaximoPct: number;
  matchAmplioPct: number; // sin recorte de ventana (referencia)
  totalWaypoints: number;
  mejorImei: string | null;
  puntosEnRutaAmplios: number;
};

async function medirOcurrencia(
  db: Database,
  repos: Repositories,
  fila: FilaOcc,
  policy: ContractPolicy,
): Promise<MedicionOcurrencia | null> {
  const occ = await repos.occurrences.findById(fila.occurrenceId);
  if (!occ?.trip || !occ.profile?.contract) return null;

  // El bug de zona horaria (2026-07-28) corrió el expected_deadline de la
  // mayoría de las ocurrencias de Tecma 47. Si se mide la ventana contra el
  // deadline SIN corregir, esta medición se contamina con ese bug ya
  // diagnosticado — un resultado casi todo "condenado" con match_max%≈0 sería
  // en parte reflejo del zona-bug, no del problema nuevo de ventana-vs-ruta.
  // Se corrige aquí SOLO cuando clasificarDiferencia dice "zona"; Campus
  // Santos Dumont ya se verificó que no lo tiene (causa "deriva", -5 min).
  const turno = await cargarTurnoYPlanta(db, occ.id);
  let deadline = occ.expectedDeadline;
  if (turno) {
    const diff = clasificarDiferencia({
      serviceDate: occ.serviceDate,
      guardado: occ.expectedDeadline,
      shiftStartTime: turno.startTime,
      anticipationMinutes: policy.arrivalAnticipationMinutes ?? 15,
      timeZone: policy.timeZone ?? JTTEL_TZ,
    });
    if (diff.causa === "zona") deadline = diff.correcto;
  }

  const kml = await repos.routes.getKmlVersionForDate(fila.routeId, deadline);
  if (!kml?.waypoints?.length) return null;
  const waypoints = kml.waypoints;

  const kmlLargoKm = waypoints
    .slice(1)
    .reduce((acc, w, i) => acc + haversineKm(waypoints[i]!.lat, waypoints[i]!.lng, w.lat, w.lng), 0);

  const { windowStart, windowEnd } = computeEvidenceWindow(deadline, {
    evidenceMarginMinutesBefore: policy.evidenceMarginMinutesBefore ?? 60,
    verificationGraceMinutes: policy.verificationGraceMinutes ?? 15,
    evidenceMarginMinutesAfter: policy.evidenceMarginMinutesAfter ?? 30,
  });

  const contract = occ.profile.contract;
  const devices = await repos.fleet.getDevicesForCarrier(contract.carrierAccountId);
  const imeis = devices.map((d) => d.imei);
  if (imeis.length === 0) return null;

  const busquedaInicio = new Date(deadline.getTime() - BUSQUEDA_HORAS_ANTES * 3_600_000);
  const busquedaFin = new Date(deadline.getTime() + BUSQUEDA_HORAS_DESPUES * 3_600_000);
  const puntosAmplios = await repos.telemetry.getForImeis(imeis, busquedaInicio, busquedaFin);
  if (puntosAmplios.length === 0) return null;

  const porImei = new Map<string, typeof puntosAmplios>();
  for (const p of puntosAmplios) {
    const arr = porImei.get(p.imei) ?? [];
    arr.push(p);
    porImei.set(p.imei, arr);
  }

  let mejorImei: string | null = null;
  let mejorCobertura = -1;
  for (const [imei, pts] of porImei) {
    let cubiertos = 0;
    for (const w of waypoints) {
      const hay = pts.some((p) => haversineKm(w.lat, w.lng, p.latitude, p.longitude) <= UMBRAL_CORREDOR_KM);
      if (hay) cubiertos++;
    }
    if (cubiertos > mejorCobertura) {
      mejorCobertura = cubiertos;
      mejorImei = imei;
    }
  }
  if (!mejorImei) return null;

  const puntos = porImei.get(mejorImei)!;
  const puntosEnRuta = puntos.filter((p) =>
    waypoints.some((w) => haversineKm(w.lat, w.lng, p.latitude, p.longitude) <= UMBRAL_CORREDOR_KM),
  );
  const duracionRealMin =
    puntosEnRuta.length >= 2
      ? (Math.max(...puntosEnRuta.map((p) => p.recordedAt.getTime())) -
          Math.min(...puntosEnRuta.map((p) => p.recordedAt.getTime()))) /
        60_000
      : null;

  let matchAmplio = 0;
  let matchEnVentana = 0;
  for (const w of waypoints) {
    let mejorDist = Infinity;
    let tsDeLaMasCercana: Date | null = null;
    for (const p of puntos) {
      const d = haversineKm(w.lat, w.lng, p.latitude, p.longitude);
      if (d < mejorDist) {
        mejorDist = d;
        tsDeLaMasCercana = p.recordedAt;
      }
    }
    if (mejorDist <= UMBRAL_CORREDOR_KM) {
      matchAmplio++;
      if (tsDeLaMasCercana && tsDeLaMasCercana >= windowStart && tsDeLaMasCercana <= windowEnd) {
        matchEnVentana++;
      }
    }
  }

  const ventanaMin = (windowEnd.getTime() - windowStart.getTime()) / 60_000;

  return {
    ventanaMin,
    duracionRealMin,
    kmlLargoKm,
    matchMaximoPct: (matchEnVentana / waypoints.length) * 100,
    matchAmplioPct: (matchAmplio / waypoints.length) * 100,
    totalWaypoints: waypoints.length,
    mejorImei,
    puntosEnRutaAmplios: puntosEnRuta.length,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const db = createDb(url);
  const repos = createRepositories(db);

  console.log(`\n${"=".repeat(78)}`);
  console.log("  VENTANA DE OBSERVACIÓN vs. DURACIÓN REAL DE LA RUTA (SOLO LECTURA)");
  console.log(`${"=".repeat(78)}\n`);

  const todas = await cargarOcurrencias(db);
  console.log(`  ${todas.length} ocurrencias con viaje en los dos contratos.`);

  const porRuta = new Map<string, FilaOcc[]>();
  for (const f of todas) {
    const arr = porRuta.get(f.routeShiftId) ?? [];
    arr.push(f);
    porRuta.set(f.routeShiftId, arr);
  }

  type ResultadoRuta = {
    contrato: string;
    ruta: string;
    turno: string;
    kmlMatchMinPct: number;
    medicion: MedicionOcurrencia;
    representanteFecha: string;
  };
  const resultados: ResultadoRuta[] = [];

  let i = 0;
  const totalRutas = porRuta.size;
  for (const [, occs] of porRuta) {
    i++;
    const representantes = occs.slice(0, REPRESENTANTES_POR_RUTA);
    const primero = representantes[0]!;
    const contractPolicy = (await repos.occurrences.findById(primero.occurrenceId))?.profile?.contract
      ?.policy as ContractPolicy | undefined;
    if (!contractPolicy) continue;

    let mejorMedicion: MedicionOcurrencia | null = null;
    let mejorFecha = "";
    for (const rep of representantes) {
      try {
        const m = await medirOcurrencia(db, repos, rep, contractPolicy);
        if (m && (!mejorMedicion || m.matchMaximoPct > mejorMedicion.matchMaximoPct)) {
          mejorMedicion = m;
          mejorFecha = rep.serviceDate;
        }
      } catch (err) {
        console.error(`  ✖ ${rep.occurrenceId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (mejorMedicion) {
      resultados.push({
        contrato: primero.contrato,
        ruta: primero.ruta,
        turno: primero.turno,
        kmlMatchMinPct: contractPolicy.kmlMatchMinPct ?? 60,
        medicion: mejorMedicion,
        representanteFecha: mejorFecha,
      });
    }
    if (i % 10 === 0) console.log(`  ...${i}/${totalRutas} rutas medidas`);
  }

  resultados.sort((a, b) => a.medicion.matchMaximoPct - b.medicion.matchMaximoPct);

  console.log(`\n${"=".repeat(78)}`);
  console.log("  RANKING — ventana vs. duración real, de peor a mejor");
  console.log(`${"=".repeat(78)}\n`);
  console.log(
    "  ruta                                turno            ventana  dur.real  KML(km)  match_max%  umbral%  condenada",
  );
  console.log("  " + "-".repeat(108));
  const condenadas = new Set<string>();
  for (const r of resultados) {
    const gap =
      r.medicion.duracionRealMin != null ? r.medicion.duracionRealMin - r.medicion.ventanaMin : null;
    const condenada = r.medicion.matchMaximoPct < r.kmlMatchMinPct;
    if (condenada) condenadas.add(`${r.contrato}||${r.ruta}||${r.turno}`);
    console.log(
      `  ${(r.contrato.slice(0, 12) + " " + r.ruta).padEnd(36)} ${r.turno.padEnd(16)} ${r.medicion.ventanaMin.toFixed(0).padStart(6)}m ${
        r.medicion.duracionRealMin != null ? r.medicion.duracionRealMin.toFixed(0).padStart(7) + "m" : "   n/d "
      }  ${r.medicion.kmlLargoKm.toFixed(1).padStart(6)}  ${r.medicion.matchMaximoPct.toFixed(1).padStart(9)}  ${r.kmlMatchMinPct.toFixed(0).padStart(6)}  ${condenada ? "⚠ SÍ" : ""}${
        gap != null && gap > 0 ? `  (ventana ${gap.toFixed(0)}min más corta)` : ""
      }`,
    );
  }

  // --- Q3: cuántos no_cumplido sellados caen en rutas condenadas ---
  const noCumplidos = todas.filter((f) => f.status === "no_cumplido");
  const noCumplidosCondenados = noCumplidos.filter((f) =>
    condenadas.has(`${f.contrato}||${f.ruta}||${f.turno}`),
  );
  const porContrato = new Map<string, { total: number; condenados: number }>();
  for (const f of noCumplidos) {
    const g = porContrato.get(f.contrato) ?? { total: 0, condenados: 0 };
    g.total++;
    if (condenadas.has(`${f.contrato}||${f.ruta}||${f.turno}`)) g.condenados++;
    porContrato.set(f.contrato, g);
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log("  IMPACTO — no_cumplido sellados en rutas estructuralmente condenadas");
  console.log(`${"=".repeat(78)}\n`);
  for (const [contrato, g] of porContrato) {
    console.log(`  ${contrato}: ${g.condenados}/${g.total} no_cumplido caen en ruta condenada`);
  }
  console.log(
    `\n  TOTAL: ${noCumplidosCondenados.length}/${noCumplidos.length} no_cumplido sellados son, por construcción, imposibles de aprobar en la ruta representativa medida.`,
  );

  // --- Reporte markdown ---
  mkdirSync(DOCS_DIR, { recursive: true });
  const md: string[] = [
    "# Ventana de observación vs. duración real de la ruta",
    "",
    "**Generado:** 2026-07-30 · solo lectura, no toca el motor, hechos ni cron.",
    "",
    "Origen: en Huertas-B, 96% de los puntos GPS caen a <150 m del trazado",
    "(mediana 60 m) pero el 45% inicial del KML (9.5 km contiguos) no tiene NI",
    "UN punto porque la ventana de observación abre después de que la ruta ya",
    "arrancó. El match se mide contra el KML completo → no puede pasar de ~55%",
    "aunque se maneje perfecto. Esto mide cuántas rutas más comparten ese",
    "problema estructural, en Tecma 47 y Campus Santos Dumont.",
    "",
    "**Método:** por cada ruta, 2 ocurrencias representativas (las más",
    "tempranas con viaje). Búsqueda de telemetría AMPLIA (deadline −4h a",
    "+3h, sin el recorte de la ventana configurada) para encontrar la mejor",
    "candidata real. `match_max%` = fracción de waypoints del KML cuyo punto",
    "más cercano (≤120 m) cae DENTRO de la ventana configurada del contrato —",
    "el techo matemático de lo que ese contrato puede llegar a medir, para esa",
    "ruta, sin importar qué tan bien maneje el carrier.",
    "",
    "| Contrato | Ruta | Turno | Ventana (min) | Duración real (min) | KML (km) | Match máx. % | Umbral % | ¿Condenada? |",
    "|---|---|---|---:|---:|---:|---:|---:|---|",
  ];
  for (const r of resultados) {
    const condenada = r.medicion.matchMaximoPct < r.kmlMatchMinPct;
    md.push(
      `| ${r.contrato} | ${r.ruta} | ${r.turno} | ${r.medicion.ventanaMin.toFixed(0)} | ${
        r.medicion.duracionRealMin != null ? r.medicion.duracionRealMin.toFixed(0) : "n/d"
      } | ${r.medicion.kmlLargoKm.toFixed(1)} | ${r.medicion.matchMaximoPct.toFixed(1)} | ${r.kmlMatchMinPct.toFixed(0)} | ${condenada ? "**SÍ**" : "no"} |`,
    );
  }
  md.push("");
  md.push("## Impacto en hechos sellados");
  md.push("");
  for (const [contrato, g] of porContrato) {
    md.push(`- **${contrato}:** ${g.condenados}/${g.total} \`no_cumplido\` caen en ruta condenada.`);
  }
  md.push(
    `- **Total: ${noCumplidosCondenados.length}/${noCumplidos.length} no_cumplido son, por construcción, imposibles de aprobar en la ruta representativa medida.**`,
  );
  writeFileSync(REPORTE_PATH, md.join("\n") + "\n");
  console.log(`\n  Reporte guardado en: ${REPORTE_PATH}`);
  console.log("\n  (solo lectura — no se tocó el motor, ningún hecho, ningún cron)\n");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
