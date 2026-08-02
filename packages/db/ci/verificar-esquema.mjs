/**
 * El contrato que faltaba:
 *
 *   **una base construida solo con las migraciones del repo sirve para todo lo
 *   que el esquema del código pide.**
 *
 * El 2026-08-02 la cara cliente entera devolvió 500 con
 * `column compliance_facts.declared_driver_name does not exist`. El esquema
 * declaraba dos columnas, la migración las creaba, y nadie la aplicó. Compilar,
 * revisar tipos y correr las pruebas unitarias pasó los tres en verde: ninguno
 * toca una base de datos.
 *
 * Dos comprobaciones, y la segunda es la que importa.
 *
 * 1. **Columna por columna.** Cada tabla y columna del esquema de Drizzle
 *    existe en la base. Atrapa el olvido en el punto exacto y con el nombre.
 *
 * 2. **La consulta relacional de verdad.** La API relacional de Drizzle pide
 *    TODAS las columnas de la tabla; las consultas con lista explícita solo las
 *    que nombran. Por eso aquel día `/api/salud` siguió devolviendo 200 —lee
 *    con listas explícitas— mientras las pantallas del cliente caían. Una
 *    comprobación que solo mirara el catálogo podría pasar y la aplicación
 *    seguir rota; esta ejecuta la consulta que se rompió.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../dist/schema/index.js";
import { getTableConfig } from "drizzle-orm/pg-core";

const cliente = postgres(process.env.DATABASE_URL, { max: 1 });

const reales = new Map();
for (const fila of await cliente`
  SELECT table_name, column_name FROM information_schema.columns
  WHERE table_schema = 'public'`) {
  if (!reales.has(fila.table_name)) reales.set(fila.table_name, new Set());
  reales.get(fila.table_name).add(fila.column_name);
}

const faltantes = [];
let tablas = 0, columnas = 0;
for (const valor of Object.values(schema)) {
  let config;
  try {
    config = getTableConfig(valor);
  } catch {
    continue; // relaciones, enums, tipos: no son tablas
  }
  tablas += 1;
  const enBase = reales.get(config.name);
  if (!enBase) {
    faltantes.push(`tabla  ${config.name}`);
    continue;
  }
  for (const col of config.columns) {
    columnas += 1;
    if (!enBase.has(col.name)) faltantes.push(`columna ${config.name}.${col.name}`);
  }
}

console.log(`Esquema del código: ${tablas} tablas, ${columnas} columnas.`);

if (faltantes.length > 0) {
  console.error(`\n✗ El código pide ${faltantes.length} cosa(s) que las migraciones no crean:\n`);
  for (const f of faltantes) console.error(`   ${f}`);
  console.error(
    "\nFalta una migración en packages/db/drizzle/. Un archivo .sql commiteado" +
      "\nno es un cambio aplicado, y declararlo en el esquema sin migración" +
      "\ntumba en producción toda consulta relacional sobre esa tabla.",
  );
  process.exit(1);
}

// La consulta que se rompió aquel día. Sobre una base vacía devuelve cero
// filas, y da igual: lo que se ejerce es que Postgres pueda resolver TODAS las
// columnas que Drizzle pide, que es exactamente lo que falló.
const db = drizzle(cliente, { schema });
await db.query.serviceOccurrences.findMany({
  with: {
    complianceFact: { with: { observedUnit: true } },
    trip: true,
    profile: { with: { geofence: true, routeShift: { with: { route: true, shift: true } } } },
    contract: true,
  },
  limit: 1,
});

console.log("✓ La base construida por las migraciones sirve al esquema del código.");
console.log("✓ La consulta relacional del expediente resuelve todas sus columnas.");
await cliente.end();
