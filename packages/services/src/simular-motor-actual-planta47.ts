/**
 * Simulación de solo lectura — las 300 congeladas de Planta 47, juzgadas por
 * el motor de HOY (ventana derivada de la ruta + match sobre el tramo
 * observable, PR #108/#111/#113/#115).
 *
 * NO ESCRIBE NADA. No hay modo `--aplicar`, no existe esa rama de código en
 * este archivo: no toca hechos, no toca el ledger, no toca el cron. Exige
 * `DATABASE_URL_READONLY` y se niega a correr sin él — nunca cae al usuario
 * de escritura "por si acaso".
 *
 * ## Qué compara
 *
 * Cada ocurrencia se juzga DOS veces, con el mismo verificador y la misma
 * evidencia, cambiando una sola cosa:
 *
 *   A. `ventana de política` — 60 min antes del deadline, la constante que
 *      estaba puesta cuando se midió el 91/209/0 de referencia.
 *   B. `ventana derivada`    — el ancho que la generación de ocurrencias le
 *      pone hoy a esta ruta (`routeWindowSizing` + `windowForOccurrence`).
 *
 * Como el verificador es el mismo en las dos columnas, la diferencia entre A
 * y B es la ventana y nada más. Y como A corre con el motor de hoy, la
 * distancia entre A y el 91/209/0 histórico es lo que aportó el arreglo del
 * match sobre el tramo observable. Las dos preguntas quedan separadas en vez
 * de mezcladas en un solo número.
 *
 * ## Cómo se parece a producción
 *
 * El camino de lectura es el de `VerificationService.verifyOccurrence`:
 * misma política de contrato, mismo corpus de rutas hermanas para los pesos
 * TF-IDF, misma tolerancia de origen, misma ventana de cobertura
 * (`computeExclusiveContentionWindow`), misma resolución imei→unidad. Tres
 * diferencias, todas declaradas:
 *
 *  1. El deadline es el CORREGIDO (`clasificarDiferencia`), no el guardado —
 *     es justo lo que la re-verificación pendiente haría. Mismos tres
 *     criterios de alcance que la ficha (§4), revalidados en vivo.
 *  2. La evidencia se relee de `telemetry_points` sobre la ventana que toca,
 *     no de `evidence_points` (que quedó anclada a la ventana vieja).
 *  3. NO se simulan las pasadas de exclusividad ni de eliminación: son
 *     cruzadas entre ocurrencias y escriben. La exclusividad solo puede
 *     QUITAR cumplidos (dos servicios que se pelean la misma unidad), así
 *     que el `cumplido` de aquí es un techo, no un piso.
 *
 * Requiere una sola variante activa por ruta; si alguna tuviera dos, el
 * script se detiene en vez de elegir por su cuenta con un criterio distinto
 * al de producción.
 *
 *   pnpm --filter @jtel/services simular-motor-actual-planta47
 */
import { existsSync } from "node:fs";
import {
  createDb,
  createRepositories,
  routeWindowSizing,
  windowForOccurrence,
  type Repositories,
} from "@jtel/db";
import {
  computeEvidenceWindow,
  type ContractPolicy,
  type DerivedObservationWindow,
  type EvidenceWindowRoute,
} from "@jtel/domain";
import { verifyService } from "@jtel/verification";
import { computeExclusiveContentionWindow } from "./verification.js";
import { validarAlcanceYCorregirDeadline } from "./reverificacion-zona-motor.js";
import { leerListaCongelada, type FilaLista } from "./lista-congelada-planta47.js";

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

/** El reparto que se midió con la ventana rota, antes de arreglar el árbitro. */
const REFERENCIA_VENTANA_ROTA = { cumplido: 91, no_cumplido: 209, pendiente_evidencia: 0 };

type Estado = "cumplido" | "no_cumplido" | "pendiente_evidencia";
type Conteo = Record<Estado, number>;

const conteoVacio = (): Conteo => ({ cumplido: 0, no_cumplido: 0, pendiente_evidencia: 0 });

/**
 * Las tres cifras con las que el motor decide, para poder explicar un cambio
 * de veredicto en vez de solo contarlo: cobertura de ruta (A), precisión de
 * corredor (B) y qué fracción del trazado alcanzó a ser observable.
 */
type Metricas = {
  unitId: string | null;
  matchPct: number | null;
  corridorPct: number | null;
  observable: number | null;
};

type Juicio = { estado: Estado; puntos: number; metricas: Metricas };

type ResultadoFila = {
  fila: FilaLista;
  guard: "ok" | string;
  politica?: Juicio;
  derivada?: Juicio;
  antesPolitica?: number;
  antesDerivada?: number;
  basis?: string;
};

type Punto = {
  imei: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  recordedAt: Date;
  unitId: string | null;
};

/** Cachés por corrida: el trazado, la flota y la historia no cambian entre las 300. */
type Cache = {
  kml: Map<string, { id: string; waypoints: Array<{ lat: number; lng: number }> } | null>;
  variantes: Map<string, Array<{ variantId: string; waypoints: Array<{ lat: number; lng: number }> }>>;
  corpus: Map<string, Array<Array<{ lat: number; lng: number }>>>;
  sizing: Map<string, EvidenceWindowRoute>;
  devices: Map<string, Awaited<ReturnType<Repositories["fleet"]["getDevicesForCarrier"]>>>;
  units: Map<string, Awaited<ReturnType<Repositories["fleet"]["getUnitsForCarrier"]>>>;
  posibles: Map<string, string[]>;
};

async function kmlDeRuta(
  repos: Repositories,
  cache: Cache,
  routeId: string,
  at: Date,
  fecha: string,
) {
  const key = `${routeId}|${fecha}`;
  if (!cache.kml.has(key)) {
    const v = await repos.routes.getKmlVersionForDate(routeId, at);
    cache.kml.set(key, v ? { id: v.id, waypoints: v.waypoints } : null);
  }
  return cache.kml.get(key)!;
}

async function main() {
  const url = process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Esta simulación no corre contra el usuario de escritura.",
    );
  }
  const db = createDb(url);
  const repos = createRepositories(db);

  // `--limite=N` corta el alcance para una corrida de humo; sin él, las 300.
  const limiteArg = process.argv.find((a) => a.startsWith("--limite="));
  const limite = limiteArg ? Number(limiteArg.split("=")[1]) : Infinity;
  const lista = leerListaCongelada().slice(0, limite);

  console.log(`\n${"=".repeat(84)}`);
  console.log(`  MOTOR DE HOY sobre las ${lista.length} congeladas de Planta 47 — SOLO LECTURA`);
  console.log(`${"=".repeat(84)}\n`);

  const cache: Cache = {
    kml: new Map(),
    variantes: new Map(),
    corpus: new Map(),
    sizing: new Map(),
    devices: new Map(),
    units: new Map(),
    posibles: new Map(),
  };

  const resultados: ResultadoFila[] = [];
  let procesadas = 0;

  for (const fila of lista) {
    try {
      const occ = await repos.occurrences.findById(fila.occurrenceId);
      if (!occ) {
        resultados.push({ fila, guard: "ocurrencia no encontrada" });
        continue;
      }
      if ((occ.complianceFact?.id ?? null) !== fila.factIdEsperado) {
        resultados.push({
          fila,
          guard: `fact_id vigente (${occ.complianceFact?.id ?? "ninguno"}) ya no coincide con la lista congelada`,
        });
        continue;
      }
      const guard = await validarAlcanceYCorregirDeadline(db, occ);
      if (!guard.ok) {
        resultados.push({ fila, guard: guard.motivo });
        continue;
      }

      const correcto = guard.correcto;
      const profile = occ.profile!;
      const contract = profile.contract!;
      const policy = contract.policy as ContractPolicy;
      const geofence = profile.geofence!;
      const routeId = profile.routeShift?.routeId;

      // --- Las dos ventanas -------------------------------------------------
      const ventanaPolicy = {
        evidenceMarginMinutesBefore: policy.evidenceMarginMinutesBefore ?? 60,
        verificationGraceMinutes: policy.verificationGraceMinutes ?? 15,
        evidenceMarginMinutesAfter: policy.evidenceMarginMinutesAfter ?? 30,
        windowDerivationEnabled: policy.windowDerivationEnabled,
        windowSlackPct: policy.windowSlackPct,
        routeAvgSpeedKmh: policy.routeAvgSpeedKmh,
        maxWindowBeforeMinutes: policy.maxWindowBeforeMinutes,
      };

      const kml = routeId ? await kmlDeRuta(repos, cache, routeId, correcto, fila.serviceDate) : null;

      if (!cache.sizing.has(profile.routeShiftId!)) {
        const samples = await repos.routeTraversals.recentSamples(profile.routeShiftId!);
        cache.sizing.set(profile.routeShiftId!, routeWindowSizing(kml?.waypoints, samples, policy));
      }
      const sizing = cache.sizing.get(profile.routeShiftId!)!;

      // Sin el tercer argumento, `computeEvidenceWindow` da la ventana de
      // siempre: el margen de política, minuto por minuto.
      const politica = computeEvidenceWindow(correcto, ventanaPolicy);
      const derivada = windowForOccurrence(correcto, ventanaPolicy, sizing);

      // --- Evidencia: una sola lectura sobre la unión de las dos ventanas ---
      const carrierId = contract.carrierAccountId;
      if (!cache.devices.has(carrierId)) {
        cache.devices.set(carrierId, await repos.fleet.getDevicesForCarrier(carrierId));
        cache.units.set(carrierId, await repos.fleet.getUnitsForCarrier(carrierId));
      }
      const devices = cache.devices.get(carrierId)!;
      const units = cache.units.get(carrierId)!;

      if (!cache.posibles.has(profile.id)) {
        cache.posibles.set(profile.id, await repos.profiles.getPossibleUnitIds(profile.id));
      }
      const possibleUnitIds = cache.posibles.get(profile.id)!;
      const candidateDevices = devices.filter((d) => {
        if (possibleUnitIds.length === 0) return true;
        return units.some((u) => possibleUnitIds.includes(u.id) && d.carrierAccountId === carrierId);
      });
      const imeis = candidateDevices.map((d) => d.imei);

      const lecturaStart = new Date(
        Math.min(politica.windowStart.getTime(), derivada.windowStart.getTime()),
      );
      const lecturaEnd = new Date(
        Math.max(politica.windowEnd.getTime(), derivada.windowEnd.getTime()),
      );
      const puntos = (await repos.telemetry.getForImeis(imeis, lecturaStart, lecturaEnd)) as Punto[];

      const imeiToUnit = new Map<string, string>();
      for (const p of puntos) if (p.unitId) imeiToUnit.set(p.imei, p.unitId);
      for (const p of puntos) {
        if (imeiToUnit.has(p.imei)) continue;
        const device = devices.find((d) => d.imei === p.imei);
        if (!device) continue;
        const asg = await repos.fleet.resolveUnitAtTime(device.id, p.recordedAt);
        if (asg) imeiToUnit.set(p.imei, asg.unitId);
      }

      // --- Corpus de rutas hermanas (pesos TF-IDF), igual que producción ----
      const corpusKey = `${occ.contractId}|${fila.serviceDate}`;
      if (!cache.corpus.has(corpusKey)) {
        const corpus: Array<Array<{ lat: number; lng: number }>> = [];
        const hermanas = await repos.profiles.findForContract(occ.contractId);
        const vistas = new Set<string>();
        for (const p of hermanas) {
          const rid = p.routeShift?.routeId;
          if (!rid || vistas.has(rid)) continue;
          vistas.add(rid);
          const k = await kmlDeRuta(repos, cache, rid, correcto, fila.serviceDate);
          if (k?.waypoints?.length) corpus.push(k.waypoints);
        }
        cache.corpus.set(corpusKey, corpus);
      }
      const routeCorpus = cache.corpus.get(corpusKey)!;

      // --- Trazado: una sola variante activa, o nos detenemos ---------------
      if (routeId) {
        const vKey = `${routeId}|${fila.serviceDate}`;
        if (!cache.variantes.has(vKey)) {
          cache.variantes.set(
            vKey,
            await repos.routes.getActiveVariantVersionsForDate(routeId, correcto),
          );
        }
        const variantes = cache.variantes.get(vKey)!;
        if (variantes.length > 1) {
          throw new Error(
            `La ruta ${fila.ruta} tiene ${variantes.length} variantes activas el ${fila.serviceDate}. ` +
              "Este simulador no reimplementa el selector multi-variante de producción; se detiene aquí.",
          );
        }
      }
      const waypoints = kml?.waypoints;

      const cobertura = computeExclusiveContentionWindow(correcto, policy);
      const juzgar = (ventana: DerivedObservationWindow) => {
        const enVentana = puntos.filter(
          (p) =>
            p.recordedAt.getTime() >= ventana.windowStart.getTime() &&
            p.recordedAt.getTime() <= ventana.windowEnd.getTime(),
        );
        const resultado = verifyService({
          occurrenceId: occ.id,
          expectedDeadline: correcto,
          toleranceMinutes: policy.toleranceMinutes,
          routeStrictness: policy.routeStrictness,
          kmlMatchMinPct: policy.kmlMatchMinPct ?? 60,
          kmlCorridorMeters: policy.kmlCorridorMeters ?? 120,
          kmlCorridorMinPct: policy.kmlCorridorMinPct ?? 60,
          kmlOriginToleranceFraction: policy.kmlOriginToleranceFraction ?? 0.15,
          geofencePolygon: geofence.polygon,
          kmlWaypoints: waypoints,
          routeCorpus: routeCorpus.length > 0 ? routeCorpus : undefined,
          evidencePoints: enVentana.map((p) => ({
            imei: imeiToUnit.get(p.imei) ?? p.imei,
            latitude: p.latitude,
            longitude: p.longitude,
            speed: p.speed ?? undefined,
            timestamp: p.recordedAt,
          })),
          excusableReasons: policy.excusableReasons,
          coverageWindowStart: new Date(cobertura.startMs),
          coverageWindowEnd: new Date(cobertura.endMs),
          evidenceMinCoveragePct: policy.evidenceMinCoveragePct ?? 80,
          evidenceMaxGapMinutes: policy.evidenceMaxGapMinutes ?? 10,
        });
        // Con veredicto hay ganador declarado; sin él, la mejor candidata por
        // min(A,B) — el mismo criterio con el que producción ordena variantes.
        const ganador =
          resultado.candidateUnits.find((c) => c.unitId === resultado.observedUnitId) ??
          [...resultado.candidateUnits].sort(
            (x, y) =>
              Math.min(y.routeMatchPct, y.corridorPrecisionPct) -
              Math.min(x.routeMatchPct, x.corridorPrecisionPct),
          )[0];
        return {
          estado: resultado.status as Estado,
          puntos: enVentana.length,
          metricas: {
            unitId: ganador?.unitId ?? null,
            matchPct: ganador ? Number(ganador.routeMatchPct.toFixed(1)) : null,
            corridorPct: ganador ? Number(ganador.corridorPrecisionPct.toFixed(1)) : null,
            observable:
              ganador?.observableFraction != null
                ? Number(ganador.observableFraction.toFixed(3))
                : null,
          },
        };
      };

      resultados.push({
        fila,
        guard: "ok",
        politica: juzgar(politica),
        derivada: juzgar(derivada),
        antesPolitica: politica.beforeMinutes,
        antesDerivada: derivada.beforeMinutes,
        basis: derivada.basis,
      });
    } catch (err) {
      resultados.push({
        fila,
        guard: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    procesadas++;
    if (procesadas % 25 === 0) console.log(`  ...${procesadas}/${lista.length} procesadas`);
  }

  imprimirReporte(resultados, lista.length);
}

function imprimirReporte(resultados: ResultadoFila[], total: number) {
  const noProcesadas = resultados.filter((r) => r.guard !== "ok");
  if (noProcesadas.length > 0) {
    console.log(`\n  NO PROCESADAS (${noProcesadas.length}) — no entran en los conteos:`);
    for (const r of noProcesadas) {
      console.log(`    ${r.fila.occurrenceId}  ${r.fila.ruta} (${r.fila.serviceDate})  — ${r.guard}`);
    }
  }

  const ok = resultados.filter((r) => r.guard === "ok" && r.derivada);
  const totPolitica = conteoVacio();
  const totDerivada = conteoVacio();
  const porRuta = new Map<
    string,
    { total: number; politica: Conteo; derivada: Conteo; antes: number; antesPol: number; basis: string }
  >();

  for (const r of ok) {
    totPolitica[r.politica!.estado]++;
    totDerivada[r.derivada!.estado]++;
    const g =
      porRuta.get(r.fila.ruta) ??
      {
        total: 0,
        politica: conteoVacio(),
        derivada: conteoVacio(),
        antes: r.antesDerivada!,
        antesPol: r.antesPolitica!,
        basis: r.basis!,
      };
    g.total++;
    g.politica[r.politica!.estado]++;
    g.derivada[r.derivada!.estado]++;
    porRuta.set(r.fila.ruta, g);
  }

  const linea = (etiqueta: string, c: Conteo) =>
    `  ${etiqueta.padEnd(34)} ${String(c.cumplido).padStart(9)} ${String(c.no_cumplido).padStart(12)} ${String(c.pendiente_evidencia).padStart(21)}`;

  console.log(`\n${"=".repeat(84)}`);
  console.log("  REPARTO — recalculado, nada escrito");
  console.log(`${"=".repeat(84)}\n`);
  console.log(`  ${"".padEnd(34)} ${"cumplido".padStart(9)} ${"no_cumplido".padStart(12)} ${"pendiente_evidencia".padStart(21)}`);
  console.log("  " + "-".repeat(80));
  // La referencia se midió sobre las 300 completas: compararle una corrida
  // parcial daría un delta que no significa nada.
  const completa = ok.length === 300;
  const signo = (n: number) => `${n >= 0 ? "+" : ""}${n}`;
  if (completa) console.log(linea("referencia (ventana rota)", REFERENCIA_VENTANA_ROTA as Conteo));
  console.log(linea("A · motor de hoy + ventana vieja", totPolitica));
  console.log(linea("B · motor de hoy + ventana derivada", totDerivada));
  console.log(`\n  procesadas: ${ok.length}/${total}`);
  if (completa) {
    console.log(
      `  se enderezan (referencia → B): ${signo(totDerivada.cumplido - REFERENCIA_VENTANA_ROTA.cumplido)} cumplidos`,
    );
    console.log(
      `    · por el match sobre lo observable (referencia → A): ${signo(totPolitica.cumplido - REFERENCIA_VENTANA_ROTA.cumplido)}`,
    );
    console.log(
      `    · por la ventana derivada (A → B): ${signo(totDerivada.cumplido - totPolitica.cumplido)}`,
    );
  } else {
    console.log(
      "  (corrida parcial: no se compara contra la referencia de 300, un delta parcial no significa nada)",
    );
  }

  console.log("\n  Por ruta — A (ventana vieja) vs B (ventana derivada):\n");
  console.log(
    "  ruta                       tot   antes(min)   base            A: c/n/p          B: c/n/p     Δc",
  );
  console.log("  " + "-".repeat(96));
  const rutas = [...porRuta.keys()].sort(
    (a, b) => (porRuta.get(b)!.derivada.cumplido - porRuta.get(b)!.politica.cumplido) -
      (porRuta.get(a)!.derivada.cumplido - porRuta.get(a)!.politica.cumplido) || a.localeCompare(b),
  );
  for (const ruta of rutas) {
    const g = porRuta.get(ruta)!;
    const a = `${g.politica.cumplido}/${g.politica.no_cumplido}/${g.politica.pendiente_evidencia}`;
    const b = `${g.derivada.cumplido}/${g.derivada.no_cumplido}/${g.derivada.pendiente_evidencia}`;
    const d = g.derivada.cumplido - g.politica.cumplido;
    console.log(
      `  ${ruta.padEnd(24)} ${String(g.total).padStart(4)}   ${String(g.antesPol).padStart(3)}→${String(g.antes).padStart(3)}   ${g.basis.padEnd(20)} ${a.padStart(10)} ${b.padStart(16)}  ${(d >= 0 ? "+" : "") + d}`,
    );
  }

  // --- Las que cambiaron de veredicto al ensanchar la ventana --------------
  // Un conteo no explica un cambio de sentencia. Aquí van las tres cifras con
  // las que el motor decidió, en las dos columnas, para poder decir SI la
  // ventana ancha descubrió más ruta (A sube, B baja) o solo metió ruido.
  const volteadas = ok.filter((r) => r.politica!.estado !== r.derivada!.estado);
  const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const resumenSalto = (etiqueta: string, filas: ResultadoFila[]) => {
    if (filas.length === 0) return;
    const dA = promedio(
      filas.map((r) => (r.derivada!.metricas.matchPct ?? 0) - (r.politica!.metricas.matchPct ?? 0)),
    );
    const dB = promedio(
      filas.map(
        (r) => (r.derivada!.metricas.corridorPct ?? 0) - (r.politica!.metricas.corridorPct ?? 0),
      ),
    );
    const dObs = promedio(
      filas.map(
        (r) => (r.derivada!.metricas.observable ?? 0) - (r.politica!.metricas.observable ?? 0),
      ),
    );
    console.log(
      `  ${etiqueta.padEnd(34)} ${String(filas.length).padStart(3)}   ΔA ${dA.toFixed(1).padStart(6)}   ΔB ${dB.toFixed(1).padStart(6)}   Δobservable ${dObs.toFixed(3).padStart(6)}`,
    );
  };

  console.log("\n  Las que cambiaron de veredicto al ensanchar la ventana (promedios):\n");
  resumenSalto(
    "no_cumplido → cumplido",
    volteadas.filter((r) => r.derivada!.estado === "cumplido"),
  );
  resumenSalto(
    "cumplido → no_cumplido",
    volteadas.filter((r) => r.politica!.estado === "cumplido" && r.derivada!.estado !== "cumplido"),
  );
  resumenSalto("todas las volteadas", volteadas);
  console.log(
    "\n  A = cobertura de ruta · B = precisión de corredor · observable = fracción del trazado calificada",
  );

  console.log("\n  Detalle por ocurrencia (CSV):\n");
  console.log(
    "occurrence_id,service_date,ruta,estado_actual,estado_vieja,estado_derivada," +
      "antes_min_vieja,antes_min_derivada,base_ventana,puntos_vieja,puntos_derivada," +
      "A_vieja,B_vieja,observable_vieja,A_derivada,B_derivada,observable_derivada",
  );
  for (const r of resultados) {
    if (r.guard !== "ok") continue;
    console.log(
      [
        r.fila.occurrenceId,
        r.fila.serviceDate,
        r.fila.ruta,
        r.fila.estadoActual,
        r.politica!.estado,
        r.derivada!.estado,
        r.antesPolitica,
        r.antesDerivada,
        r.basis,
        r.politica!.puntos,
        r.derivada!.puntos,
        r.politica!.metricas.matchPct,
        r.politica!.metricas.corridorPct,
        r.politica!.metricas.observable,
        r.derivada!.metricas.matchPct,
        r.derivada!.metricas.corridorPct,
        r.derivada!.metricas.observable,
      ].join(","),
    );
  }

  console.log(
    "\n  (solo lectura — no se escribió ningún hecho, ningún ledger, ninguna medición; el cron no se tocó)",
  );
  console.log(
    "  (la exclusividad y la eliminación no se simulan: solo pueden quitar cumplidos, así que B es un techo)\n",
  );
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
