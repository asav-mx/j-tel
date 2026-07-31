/**
 * ¿El resumen que calcula la base dice lo mismo que recorrer los puntos crudos?
 *
 * SOLO LECTURA. Trae la ventana completa del carrier (lo caro que el resumen
 * viene a evitar), la recorre con una implementación **deliberadamente
 * independiente** —escrita aquí, no importada— y compara unidad por unidad
 * contra `resumenDiarioPorUnidad`. Dos implementaciones que llegan al mismo
 * número es la única evidencia que vale; una sola compartida no probaría nada.
 *
 * Sirve para no tener que creerle al SQL: se corre contra la base real y
 * escupe las diferencias, si las hay.
 *
 *   DB_URL=... pnpm --filter @jtel/db verificar-resumen <carrierAccountId> <YYYY-MM-DD>
 */
import { existsSync } from "node:fs";
import { createDb, createRepositories } from "./index.js";

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

const HUECO_MINUTOS = 10;
const SALTO_KMH = 300;
const TOLERANCIA_KM = 0.001;

type Punto = { unitId: string | null; imei: string; latitude: number; longitude: number; recordedAt: Date };

/** Haversine, escrito aparte a propósito: es la contraparte independiente. */
function km(a: Punto, b: Punto): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function recorrerCrudo(puntos: Punto[]) {
  const orden = [...puntos].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  let kmTotal = 0;
  let saltos = 0;
  let bloques = orden.length > 0 ? 1 : 0;

  for (let i = 1; i < orden.length; i++) {
    const minutos =
      (orden[i]!.recordedAt.getTime() - orden[i - 1]!.recordedAt.getTime()) / 60_000;
    if (minutos > HUECO_MINUTOS) {
      bloques++;
      continue; // el tramo cruza un hueco: no es recorrido observado
    }
    const d = km(orden[i - 1]!, orden[i]!);
    const horas = minutos / 60;
    if (horas > 0 && d / horas > SALTO_KMH) saltos++;
    else kmTotal += d;
  }

  return {
    puntos: orden.length,
    equipos: new Set(orden.map((p) => p.imei)).size,
    kmAproximados: kmTotal,
    saltosDescartados: saltos,
    bloques,
    primerDato: orden[0]?.recordedAt ?? null,
    ultimoDato: orden[orden.length - 1]?.recordedAt ?? null,
  };
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DB_URL");

  const carrierAccountId = process.argv[2];
  const fecha = process.argv[3];
  if (!carrierAccountId || !fecha) {
    throw new Error("Uso: verificar-resumen <carrierAccountId> <YYYY-MM-DD>");
  }

  // Franja de 24 h en UTC. La zona civil la resuelve quien llama en producción;
  // aquí basta una ventana explícita porque solo se comparan dos cálculos sobre
  // los MISMOS puntos.
  const desde = new Date(`${fecha}T06:00:00Z`);
  const hasta = new Date(desde.getTime() + 24 * 3600_000);

  const db = createDb(url);
  const repos = createRepositories(db);

  const t0 = Date.now();
  const resumen = await repos.telemetry.resumenDiarioPorUnidad(carrierAccountId, [
    { fecha, desde, hasta },
  ]);
  const msResumen = Date.now() - t0;

  const t1 = Date.now();
  const crudos = await repos.telemetry.getForCarrierWindow(carrierAccountId, desde, hasta);
  const msCrudo = Date.now() - t1;

  const porUnidad = new Map<string, Punto[]>();
  for (const p of crudos as Punto[]) {
    if (!p.unitId) continue;
    const lista = porUnidad.get(p.unitId) ?? [];
    lista.push(p);
    porUnidad.set(p.unitId, lista);
  }

  console.log(
    `\n  resumen: ${resumen.length} filas en ${msResumen} ms · crudo: ${crudos.length} filas en ${msCrudo} ms\n`,
  );

  let diferencias = 0;
  for (const [unitId, puntos] of porUnidad) {
    const esperado = recorrerCrudo(puntos);
    const obtenido = resumen.find((r) => r.unitId === unitId);
    if (!obtenido) {
      console.log(`  ✖ ${unitId}: el resumen no la trae y tiene ${puntos.length} puntos`);
      diferencias++;
      continue;
    }
    const fallas: string[] = [];
    if (obtenido.puntos !== esperado.puntos) {
      fallas.push(`puntos ${obtenido.puntos} vs ${esperado.puntos}`);
    }
    if (obtenido.equipos !== esperado.equipos) {
      fallas.push(`equipos ${obtenido.equipos} vs ${esperado.equipos}`);
    }
    if (Math.abs(obtenido.kmAproximados - esperado.kmAproximados) > TOLERANCIA_KM) {
      fallas.push(
        `km ${obtenido.kmAproximados.toFixed(3)} vs ${esperado.kmAproximados.toFixed(3)}`,
      );
    }
    if (obtenido.saltosDescartados !== esperado.saltosDescartados) {
      fallas.push(`saltos ${obtenido.saltosDescartados} vs ${esperado.saltosDescartados}`);
    }
    if (obtenido.bloques.length !== esperado.bloques) {
      fallas.push(`bloques ${obtenido.bloques.length} vs ${esperado.bloques}`);
    }
    if (obtenido.primerDato?.getTime() !== esperado.primerDato?.getTime()) {
      fallas.push("primer dato");
    }
    if (obtenido.ultimoDato?.getTime() !== esperado.ultimoDato?.getTime()) {
      fallas.push("último dato");
    }
    if (fallas.length > 0) {
      console.log(`  ✖ ${unitId}: ${fallas.join(" · ")}`);
      diferencias++;
    }
  }

  const sobrantes = resumen.filter((r) => !porUnidad.has(r.unitId));
  for (const r of sobrantes) {
    console.log(`  ✖ ${r.unitId}: el resumen la trae con ${r.puntos} puntos y el crudo no`);
    diferencias++;
  }

  console.log(
    diferencias === 0
      ? `  ✓ ${porUnidad.size} unidades, cero diferencias entre el resumen y el recorrido crudo\n`
      : `\n  ${diferencias} unidades con diferencias\n`,
  );

  process.exit(diferencias === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
