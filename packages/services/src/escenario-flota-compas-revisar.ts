import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import {
  accounts,
  conexionesDelAmbiente,
  createDb,
  createRepositories,
  revisarDesechable,
} from "@jtel/db";
import { cargarFlotaCompas } from "./flota-compas.js";

/**
 * Comprueba que la clasificación de la flota ve, por las consultas de verdad,
 * lo que siembra `pnpm --filter @jtel/db escenario-flota-compas`.
 *
 *   pnpm --filter @jtel/services escenario-flota-compas-revisar
 *
 * SÓLO LEE, y sólo de la rama desechable. Sale con 1 si algún estado no es el
 * esperado: una revisión que no puede fallar no revisa nada.
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

/** Lo que el escenario siembra, por etiqueta. Si el escenario cambia, esto cambia con él. */
const ESPERADO = {
  unidades: {
    "10254": "en_linea/en_movimiento",
    "10261": "en_linea/detenida",
    "10299": "en_linea/sin_velocidad",
    "10288": "callada",
    "10295": "callada",
    "10290": "desconectado",
    "10301": "sin_dispositivo",
    "10320": "sin_dispositivo",
  } as Record<string, string>,
  dispositivos: {
    "TK-ESC-001": "en_unidad",
    "TK-ESC-002": "en_unidad",
    "TK-ESC-003": "en_unidad",
    "TK-ESC-004": "en_unidad",
    "TK-ESC-005": "en_unidad",
    "TK-ESC-006": "desconectado",
    "TK-ESC-007": "en_bodega",
    "TK-ESC-008": "en_bodega",
    "TK-ESC-009": "de_baja",
    "TK-ESC-010": "de_baja",
  } as Record<string, string>,
  unidadesInactivas: 1,
  dispositivosDeBajaMontados: 1,
};

const veredicto = revisarDesechable({
  objetivo: process.env.DATABASE_URL_TEST,
  otras: conexionesDelAmbiente(process.env),
});
if (!veredicto.ok) {
  console.error(`\n  ✗ [revisar-flota] ${veredicto.motivo}\n`);
  process.exit(1);
}

const db = createDb(process.env.DATABASE_URL_TEST!);
const [cuenta] = await db.select().from(accounts).where(eq(accounts.slug, "escenario-flota-compas"));
if (!cuenta) {
  console.error("  ✗ [revisar-flota] No hay escenario. Siémbralo: pnpm --filter @jtel/db escenario-flota-compas");
  process.exit(1);
}

const flota = await cargarFlotaCompas(createRepositories(db), cuenta.id, new Date());
const fallas: string[] = [];

console.log("\nUNIDADES");
for (const { unidad, estado, grupo } of flota.unidades) {
  const visto = estado.tipo === "en_linea" ? `en_linea/${estado.postura}` : estado.tipo;
  const ok = ESPERADO.unidades[unidad.label] === visto;
  if (!ok) fallas.push(`unidad ${unidad.label}: esperaba ${ESPERADO.unidades[unidad.label]}, vio ${visto}`);
  console.log(`  ${ok ? "✓" : "✗"} ${unidad.label.padEnd(8)} ${visto.padEnd(24)} grupo: ${grupo ?? "(por decidir)"}`);
}

console.log("\nDISPOSITIVOS");
for (const { dispositivo, estado } of flota.dispositivos) {
  const etiqueta = dispositivo.label ?? dispositivo.imei;
  const ok = ESPERADO.dispositivos[etiqueta] === estado.grupo;
  if (!ok) fallas.push(`dispositivo ${etiqueta}: esperaba ${ESPERADO.dispositivos[etiqueta]}, vio ${estado.grupo}`);
  console.log(`  ${ok ? "✓" : "✗"} ${etiqueta.padEnd(12)} ${estado.grupo}`);
}

if (flota.unidadesInactivas !== ESPERADO.unidadesInactivas) {
  fallas.push(`unidades inactivas: esperaba ${ESPERADO.unidadesInactivas}, vio ${flota.unidadesInactivas}`);
}
if (flota.anomalias.dispositivosDeBajaMontados.length !== ESPERADO.dispositivosDeBajaMontados) {
  fallas.push(`dispositivos de baja montados: vio ${flota.anomalias.dispositivosDeBajaMontados.length}`);
}
if (flota.unidades.length !== Object.keys(ESPERADO.unidades).length) {
  fallas.push(`unidades en la flota: esperaba ${Object.keys(ESPERADO.unidades).length}, vio ${flota.unidades.length}`);
}

console.log(
  `\n  inactivas: ${flota.unidadesInactivas} · de baja montados: ${flota.anomalias.dispositivosDeBajaMontados.length}` +
    ` · tiene contrato: ${flota.tieneContrato}`,
);
if (fallas.length > 0) {
  console.error(`\n  ✗ ${fallas.length} diferencia(s):`);
  for (const f of fallas) console.error(`    · ${f}`);
  process.exit(1);
}
console.log("\n  ✓ la clasificación ve exactamente lo que se sembró\n");
process.exit(0);
