/**
 * Escribe `kmlOriginToleranceFraction` en el contrato que no lo tiene.
 *
 * **En seco por omisión.** Sin `--ejecutar` solo enseña el antes y el después.
 *
 * ## Por qué existe
 *
 * El Campus corre hoy con el valor de FÁBRICA de esa perilla porque su política
 * no la trae. El valor coincide con el que Planta 47 tiene escrito —0.15— así
 * que **hoy no cambia el comportamiento de nada**. Lo que cambia es de dónde
 * sale la regla.
 *
 * **Ley 6 del Marco:** todo umbral y tolerancia es configurable por contrato, y
 * la UI guarda el acuerdo, no lo decide. Un valor de fábrica que puede cambiar
 * la regla de un cliente **sin que nadie toque su contrato y sin dejar rastro**
 * es exactamente lo que esa ley prohíbe.
 *
 * ## Lo que NO hace
 *
 * No re-verifica nada, no toca un hecho sellado y no cambia ningún veredicto —
 * la política congelada dentro de cada hecho ya existente se queda como está.
 * Solo escribe el valor que hoy se aplica, en el lugar donde debería estar.
 *
 *   pnpm --filter @jtel/db exec tsx src/escribir-tolerancia-origen.ts
 *   pnpm --filter @jtel/db exec tsx src/escribir-tolerancia-origen.ts --ejecutar
 */
import { existsSync } from "node:fs";
import postgres from "postgres";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) { try { process.loadEnvFile(p); break; } catch { /* ignore */ } }
}

/** El valor de fábrica del motor. Se copia a mano y a propósito: si algún día
 *  cambia allá, este guion tiene que fallar la comparación y obligar a mirar. */
const VALOR_DE_FABRICA = 0.15;
const CAMPO = "kmlOriginToleranceFraction";

const ejecutar = process.argv.includes("--ejecutar");
const url = ejecutar ? process.env.DATABASE_URL : (process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL);
if (!url) { console.error("Falta la URL de la base."); process.exit(1); }
const db = postgres(url, { max: 1, connect_timeout: 20, idle_timeout: 5 });

const filas = await db`
  select c.id, c.name, c.policy, a.slug
  from service_contracts c join accounts a on a.id = c.client_account_id
  where a.is_demo = false order by a.slug, c.name`;

console.log(`\n  ${ejecutar ? "EJECUTANDO" : "EN SECO — no se escribe nada"}\n`);
const faltan = filas.filter((f) => (f.policy as Record<string, unknown>)[CAMPO] === undefined);

for (const f of filas) {
  const v = (f.policy as Record<string, unknown>)[CAMPO];
  console.log(`  ${String(f.name).padEnd(44)} ${v === undefined ? `— (aplica ${VALOR_DE_FABRICA} de fábrica)` : `${v} (escrito)`}`);
}

if (faltan.length === 0) { console.log("\n  Nada que escribir.\n"); await db.end(); process.exit(0); }

console.log(`\n  Se escribiría ${CAMPO} = ${VALOR_DE_FABRICA} en ${faltan.length} contrato(s):`);
for (const f of faltan) console.log(`    ${f.name}`);
console.log(`\n  Cambio de comportamiento esperado: NINGUNO — es el mismo valor que ya se aplica.`);
console.log(`  Hechos sellados afectados: NINGUNO — la política congelada de cada hecho no se toca.\n`);

if (!ejecutar) {
  console.log("  Para escribirlo: agrega --ejecutar\n");
  await db.end();
  process.exit(0);
}

for (const f of faltan) {
  await db`update service_contracts
    set policy = policy || ${JSON.stringify({ [CAMPO]: VALOR_DE_FABRICA })}::jsonb,
        updated_at = now()
    where id = ${f.id as string}`;
  console.log(`  ✓ escrito en ${f.name}`);
}
console.log("");
await db.end();
