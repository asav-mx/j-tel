/**
 * Análisis de solo-lectura — ¿qué tan mal está el trazado KML de cada ruta
 * de Planta 47, comparado contra el mejor recorrido real que se le pudo
 * encontrar?
 *
 * NO ESCRIBE NADA en la base. No toca hechos, no toca el cron, no modifica
 * ningún KML. Lo único que produce son archivos nuevos en disco para que
 * Asav los revise a ojo:
 *
 *   - docs/correcciones/2026-07-30-kml-sospechoso-planta47.md
 *       Tabla de las 21 rutas, ordenada de peor a mejor.
 *   - docs/correcciones/kml-vs-real/<ruta>.geojson  (las 3 peores)
 *       KML de la ruta + recorrido real de su mejor candidata, en GeoJSON.
 *
 * Para cada ruta, entre TODAS sus ocurrencias en la lista congelada, se
 * queda con la MEJOR candidata que se le haya encontrado en cualquier
 * fecha — el mejor caso posible, no el peor. Si incluso el mejor caso queda
 * lejos del umbral (60% match, 60% corredor, ≤0.8 km Fréchet), la ruta es
 * sospechosa de tener el KML mal digitalizado, no un problema de un día
 * suelto.
 *
 * Mismo núcleo que el piloto y el simulador de 300
 * (reverificacion-zona-motor.ts) — ningún atajo, ningún agregado por ruta
 * que no haya pasado por verifyService().
 *
 *   pnpm --filter @jtel/services exec tsx src/analizar-kml-sospechoso-planta47.ts
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createDb, createRepositories } from "@jtel/db";
import {
  validarAlcanceYCorregirDeadline,
  reverificarConEvidenciaCorregida,
} from "./reverificacion-zona-motor.js";
import { leerListaCongelada } from "./lista-congelada-planta47.js";

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
const GEOJSON_DIR = resolve(DOCS_DIR, "kml-vs-real");
const REPORTE_PATH = resolve(DOCS_DIR, "2026-07-30-kml-sospechoso-planta47.md");

type Candidato = {
  unitId: string;
  routeMatchPct: number;
  corridorPrecisionPct: number;
  frechetKm?: number | null;
  directionSimilarity?: number | null;
};

/** Misma comparación que usa verifyService internamente para elegir ganador — aplicada
 *  a TODOS los candidatos, no solo a los que ya cruzaron el umbral. */
function comparar(a: Candidato, b: Candidato): number {
  const scoreA = Math.min(a.routeMatchPct, a.corridorPrecisionPct);
  const scoreB = Math.min(b.routeMatchPct, b.corridorPrecisionPct);
  const diff = scoreB - scoreA;
  if (Math.abs(diff) >= 1) return diff;
  const fA = a.frechetKm ?? Infinity;
  const fB = b.frechetKm ?? Infinity;
  if (Math.abs(fA - fB) >= 0.05) return fA - fB;
  const dA = a.directionSimilarity ?? 0;
  const dB = b.directionSimilarity ?? 0;
  return dB - dA;
}

type MejorPorRuta = {
  ruta: string;
  turno: string;
  candidato: Candidato;
  occurrenceId: string;
  serviceDate: string;
  unitLabel: string;
  algunaVezCumplido: boolean;
  kmlWaypoints: Array<{ lat: number; lng: number }>;
  puntosReales: Array<{ lat: number; lng: number; recordedAt: Date }>;
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const db = createDb(url);
  const repos = createRepositories(db);

  const lista = leerListaCongelada();
  console.log(`\n${"=".repeat(78)}`);
  console.log(`  ANÁLISIS DE KML SOSPECHOSO — ${lista.length} ocurrencias (SOLO LECTURA)`);
  console.log(`${"=".repeat(78)}\n`);

  const mejores = new Map<string, MejorPorRuta>();
  let procesadas = 0;

  for (const fila of lista) {
    try {
      const occ = await repos.occurrences.findById(fila.occurrenceId);
      if (!occ) continue;
      if ((occ.complianceFact?.id ?? null) !== fila.factIdEsperado) continue;
      const guard = await validarAlcanceYCorregirDeadline(db, occ);
      if (!guard.ok) continue;

      const { verification, memoryPoints, units, imeiToUnit, kml } =
        await reverificarConEvidenciaCorregida(repos, occ, guard.correcto);

      if (verification.candidateUnits.length > 0 && kml?.waypoints?.length) {
        const candidato = [...verification.candidateUnits].sort(comparar)[0]!;
        const actual = mejores.get(fila.ruta);
        const esMejor = !actual || comparar(candidato, actual.candidato) < 0;

        if (esMejor) {
          const rawImeis = [...imeiToUnit.entries()]
            .filter(([, unitId]) => unitId === candidato.unitId)
            .map(([imei]) => imei);
          const imeisDeInteres = rawImeis.length > 0 ? rawImeis : [candidato.unitId];
          const puntosReales = memoryPoints
            .filter((p) => imeisDeInteres.includes(p.imei))
            .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
            .map((p) => ({ lat: p.latitude, lng: p.longitude, recordedAt: p.recordedAt }));

          mejores.set(fila.ruta, {
            ruta: fila.ruta,
            turno: fila.turno,
            candidato,
            occurrenceId: fila.occurrenceId,
            serviceDate: fila.serviceDate,
            unitLabel: units.find((u) => u.id === candidato.unitId)?.label ?? candidato.unitId.slice(0, 8),
            algunaVezCumplido:
              (actual?.algunaVezCumplido ?? false) || verification.status === "cumplido",
            kmlWaypoints: kml.waypoints,
            puntosReales,
          });
        } else if (verification.status === "cumplido") {
          actual!.algunaVezCumplido = true;
        }
      }
    } catch (err) {
      console.error(`  ✖ ${fila.occurrenceId}: ${err instanceof Error ? err.message : String(err)}`);
    }
    procesadas++;
    if (procesadas % 50 === 0) console.log(`  ...${procesadas}/${lista.length} procesadas`);
  }

  // `comparar` ordena de MEJOR a peor (así elige ganador verifyService) — para
  // el ranking queremos lo contrario: peor primero.
  const ranking = [...mejores.values()].sort((a, b) => comparar(b.candidato, a.candidato));

  console.log(`\n${"=".repeat(78)}`);
  console.log("  RANKING — de peor a mejor mejor-caso-posible por ruta");
  console.log(`${"=".repeat(78)}\n`);
  console.log(
    "  ruta                          turno  match%  corredor%  fréchet(km)  fecha        ¿pasó alguna vez?",
  );
  console.log("  " + "-".repeat(96));
  for (const r of ranking) {
    console.log(
      `  ${r.ruta.padEnd(30)} ${r.turno.padEnd(7)}${r.candidato.routeMatchPct.toFixed(1).padStart(6)}  ${r.candidato.corridorPrecisionPct.toFixed(1).padStart(8)}   ${(r.candidato.frechetKm ?? -1).toFixed(3).padStart(9)}  ${r.serviceDate}   ${r.algunaVezCumplido ? "sí" : "NUNCA"}`,
    );
  }

  // --- Reporte markdown ---
  mkdirSync(DOCS_DIR, { recursive: true });
  const lineasMd: string[] = [
    "# Ranking de KML sospechoso — Planta 47",
    "",
    "**Generado:** 2026-07-30 · solo lectura, no modifica hechos ni KML.",
    "",
    "Para cada ruta, se muestra su MEJOR candidata encontrada en cualquiera de sus",
    "ocurrencias de la lista congelada — el mejor caso posible, no el peor. Si el",
    "mejor caso ya queda lejos del umbral (60% match, 60% corredor, ≤0.8 km",
    "Fréchet), es señal de que el trazado del KML no corresponde al camino real,",
    "no de un día suelto con mala señal.",
    "",
    "| Ruta | Turno | Match % | Corredor % | Fréchet (km) | Fecha (mejor caso) | Unidad | ¿Pasó alguna vez? |",
    "|---|---|---:|---:|---:|---|---|---|",
  ];
  for (const r of ranking) {
    lineasMd.push(
      `| ${r.ruta} | ${r.turno} | ${r.candidato.routeMatchPct.toFixed(1)} | ${r.candidato.corridorPrecisionPct.toFixed(1)} | ${(r.candidato.frechetKm ?? -1).toFixed(3)} | ${r.serviceDate} | ${r.unitLabel} | ${r.algunaVezCumplido ? "sí" : "**nunca**"} |`,
    );
  }
  writeFileSync(REPORTE_PATH, lineasMd.join("\n") + "\n");
  console.log(`\n  Reporte guardado en: ${REPORTE_PATH}`);

  // --- GeoJSON de las 3 peores ---
  mkdirSync(GEOJSON_DIR, { recursive: true });
  const peores3 = ranking.slice(0, 3);
  for (const r of peores3) {
    const slug = r.ruta
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const geojson = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            nombre: `KML — ${r.ruta}`,
            tipo: "trazado_kml",
          },
          geometry: {
            type: "LineString",
            coordinates: r.kmlWaypoints.map((w) => [w.lng, w.lat]),
          },
        },
        {
          type: "Feature",
          properties: {
            nombre: `Recorrido real — ${r.ruta} — ${r.unitLabel} — ${r.serviceDate}`,
            tipo: "recorrido_real",
            unidad: r.unitLabel,
            fecha: r.serviceDate,
            routeMatchPct: r.candidato.routeMatchPct,
            corridorPrecisionPct: r.candidato.corridorPrecisionPct,
            frechetKm: r.candidato.frechetKm,
          },
          geometry: {
            type: "LineString",
            coordinates: r.puntosReales.map((p) => [p.lng, p.lat]),
          },
        },
      ],
    };
    const filePath = resolve(GEOJSON_DIR, `${slug}.geojson`);
    writeFileSync(filePath, JSON.stringify(geojson, null, 2));
    console.log(`  GeoJSON: ${filePath}  (${r.puntosReales.length} puntos reales, ${r.kmlWaypoints.length} waypoints KML)`);
  }

  console.log("\n  (solo lectura — no se escribió nada en la base, no se tocó el cron, ningún KML modificado)\n");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
