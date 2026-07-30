/**
 * Simulador de solo-lectura — re-verificación de las 300 ocurrencias de la
 * lista congelada (Planta 47, bug de zona horaria del 2026-07-28).
 *
 * NO ESCRIBE NADA. Ni un UPDATE, ni un INSERT — no hay modo `--aplicar`, no
 * existe esa rama de código en este archivo. Es la reconstrucción permanente
 * del número que dio la ficha (161/139/0) porque el script que lo produjo
 * originalmente (`_dry_run_plant47.ts`) no está en el repo — no en el árbol
 * de trabajo, no en ningún commit, no en el stash. No se puede diferenciar
 * contra algo que no existe; esto es la reconstrucción, no una comparación
 * línea a línea.
 *
 * Usa el MISMO núcleo que el piloto (reverificacion-zona-motor.ts):
 * verifyService() puro, una sola versión de KML, evidencia releída de
 * telemetry_points sobre la ventana YA corregida. Nada de agregados por
 * ruta, nada de atajos — cada una de las 300 pasa por el verificador
 * estricto, una por una.
 *
 * Fuente del alcance: el CSV embebido en
 * docs/correcciones/2026-07-30-lista-congelada-planta47.md — la misma lista
 * que ya se congeló antes de correr nada (§4 de la ficha). No se regenera el
 * criterio de selección aquí; se lee tal cual quedó guardado.
 *
 *   pnpm --filter @jtel/services exec tsx src/simular-reverificacion-planta47.ts
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "@jtel/db";
import {
  validarAlcanceYCorregirDeadline,
  reverificarConEvidenciaCorregida,
} from "./reverificacion-zona-motor.js";
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

/**
 * Reparto por ruta que reporta la ficha (§2), para comparar contra lo que
 * calcula este simulador. Literal de
 * docs/marco-limpio/Ficha-Reverificacion-Deadline-Zona.md.
 */
const FICHA_CUMPLIDOS_POR_RUTA: Record<string, { cumplidos: number; total: number }> = {
  "Km 30 - B": { cumplidos: 15, total: 15 },
  "Riveras 9 - B": { cumplidos: 15, total: 15 },
  "San Jose - B": { cumplidos: 13, total: 15 },
  "Juarez Nuevo - B": { cumplidos: 13, total: 15 },
  "San Jose Auxiliar - B": { cumplidos: 10, total: 15 },
  "Huertas - B": { cumplidos: 0, total: 15 },
  "Oasis - A": { cumplidos: 13, total: 14 },
  "Colinas - A": { cumplidos: 12, total: 14 },
  "San Isidro - A": { cumplidos: 12, total: 14 },
  "Km 30 - A": { cumplidos: 10, total: 14 },
  "Safari - A": { cumplidos: 10, total: 14 },
  "Finca Auxiliar - A": { cumplidos: 7, total: 14 },
  "Sierra Vista - A": { cumplidos: 4, total: 14 },
  "Centro - A": { cumplidos: 0, total: 14 },
  "Riveras 9 - A": { cumplidos: 6, total: 14 },
  "Finca - A": { cumplidos: 6, total: 14 },
  "Juarez Nuevo - A": { cumplidos: 5, total: 14 },
  "Sanders - A": { cumplidos: 5, total: 14 },
  "Riveras 7 - A": { cumplidos: 3, total: 14 },
  "Km 20 - A": { cumplidos: 2, total: 14 },
  "Parajes del Sur - A": { cumplidos: 0, total: 14 },
};
const FICHA_TOTAL = { cumplido: 161, no_cumplido: 139, pendiente_evidencia: 0 };

type ResultadoFila = {
  fila: FilaLista;
  guard: "ok" | string;
  status?: "cumplido" | "no_cumplido" | "pendiente_evidencia";
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  const db = createDb(url);
  const repos = createRepositories(db);

  const lista = leerListaCongelada();
  console.log(`\n${"=".repeat(78)}`);
  console.log(`  SIMULADOR — reconstrucción de las ${lista.length} ocurrencias (SOLO LECTURA)`);
  console.log(`${"=".repeat(78)}\n`);

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
      const { verification } = await reverificarConEvidenciaCorregida(repos, occ, guard.correcto);
      resultados.push({ fila, guard: "ok", status: verification.status });
    } catch (err) {
      resultados.push({ fila, guard: `error: ${err instanceof Error ? err.message : String(err)}` });
    }
    procesadas++;
    if (procesadas % 25 === 0) console.log(`  ...${procesadas}/${lista.length} procesadas`);
  }

  const noProcesadas = resultados.filter((r) => r.guard !== "ok");
  if (noProcesadas.length > 0) {
    console.log(`\n  NO PROCESADAS (${noProcesadas.length}) — no entran en los conteos:`);
    for (const r of noProcesadas) {
      console.log(`    ${r.fila.occurrenceId}  ${r.fila.ruta} (${r.fila.serviceDate})  — ${r.guard}`);
    }
  }

  const ok = resultados.filter((r) => r.guard === "ok" && r.status);
  const conteos = { cumplido: 0, no_cumplido: 0, pendiente_evidencia: 0 };
  const porRuta = new Map<string, { cumplido: number; no_cumplido: number; pendiente_evidencia: number }>();
  for (const r of ok) {
    conteos[r.status!]++;
    const g = porRuta.get(r.fila.ruta) ?? { cumplido: 0, no_cumplido: 0, pendiente_evidencia: 0 };
    g[r.status!]++;
    porRuta.set(r.fila.ruta, g);
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log("  REPARTO NUEVO (recalculado, no escrito)");
  console.log(`${"=".repeat(78)}\n`);
  console.log(`  cumplido:             ${conteos.cumplido}  (ficha: ${FICHA_TOTAL.cumplido})`);
  console.log(`  no_cumplido:          ${conteos.no_cumplido}  (ficha: ${FICHA_TOTAL.no_cumplido})`);
  console.log(`  pendiente_evidencia:  ${conteos.pendiente_evidencia}  (ficha: ${FICHA_TOTAL.pendiente_evidencia})`);
  console.log(`  procesadas: ${ok.length}/${lista.length}  (no procesadas: ${noProcesadas.length})`);

  console.log("\n  Por ruta — recalculado vs. ficha:\n");
  console.log(
    "  ruta                          cumplido(nuevo)  cumplido(ficha)  total  dif",
  );
  console.log("  " + "-".repeat(78));
  const rutas = [...new Set([...porRuta.keys(), ...Object.keys(FICHA_CUMPLIDOS_POR_RUTA)])].sort();
  const difieren: string[] = [];
  for (const ruta of rutas) {
    const nuevo = porRuta.get(ruta);
    const ficha = FICHA_CUMPLIDOS_POR_RUTA[ruta];
    const nuevoCumplidos = nuevo?.cumplido ?? 0;
    const nuevoTotal = nuevo ? nuevo.cumplido + nuevo.no_cumplido + nuevo.pendiente_evidencia : 0;
    const fichaCumplidos = ficha?.cumplidos ?? "?";
    const dif = ficha && nuevo ? nuevoCumplidos - ficha.cumplidos : null;
    const marca = dif === 0 ? "" : dif === null ? " (sin dato para comparar)" : ` ⚠ ${dif > 0 ? "+" : ""}${dif}`;
    if (dif !== 0 && dif !== null) difieren.push(ruta);
    console.log(
      `  ${ruta.padEnd(30)} ${String(nuevoCumplidos).padStart(15)}  ${String(fichaCumplidos).padStart(15)}  ${String(nuevoTotal).padStart(5)}  ${marca}`,
    );
  }

  console.log(`\n  Rutas que difieren del número de la ficha: ${difieren.length ? difieren.join(", ") : "ninguna"}`);
  console.log("\n  (solo lectura — no se escribió nada, no se tocó el cron, no se tocó ningún hecho)\n");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
