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
import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

for (const p of ["../../.env", ".env"]) {
  if (existsSync(p)) { try { process.loadEnvFile(p); break; } catch { /* ignore */ } }
}

const CAMPO = "kmlOriginToleranceFraction";

/**
 * El valor de fábrica **leído del motor**, no copiado a mano.
 *
 * Copiarlo sería exactamente el defecto que este guion existe para cerrar: un
 * número que vive en dos lados y se separa sin que nadie lo note. Se lee de
 * `packages/verification/src/index.ts`, y **si no se puede leer, el guion se
 * niega a correr** — antes escribir nada que escribir un valor que no se pudo
 * comprobar.
 */
function valorDeFabrica(): number {
  const ruta = new URL("../../verification/src/index.ts", import.meta.url);
  const fuente = readFileSync(ruta, "utf8");
  const m = fuente.match(/DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION\s*=\s*([0-9.]+)/);
  if (!m) {
    throw new Error(
      "No se pudo leer DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION del motor. " +
        "El guion no escribe un valor que no pudo comprobar.",
    );
  }
  return Number(m[1]);
}

const VALOR_DE_FABRICA = valorDeFabrica();

const ejecutar = process.argv.includes("--ejecutar");
const url = ejecutar ? process.env.DATABASE_URL : (process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL);
if (!url) { console.error("Falta la URL de la base."); process.exit(1); }
const db = postgres(url, { max: 1, connect_timeout: 20, idle_timeout: 5 });

const filas = await db`
  select c.id, c.name, c.policy, a.slug
  from service_contracts c join accounts a on a.id = c.client_account_id
  where a.is_demo = false order by a.slug, c.name`;

console.log(`\n  ${ejecutar ? "EJECUTANDO" : "EN SECO — no se escribe nada"}\n`);
console.log(`  Valor de fábrica leído del motor: ${VALOR_DE_FABRICA}`);
console.log(`  (packages/verification/src/index.ts · DEFAULT_KML_ORIGIN_TOLERANCE_FRACTION)`);
console.log(`  Es EXACTAMENTE lo que se escribiría. Cambia quién manda, no el comportamiento.\n`);
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

/*
 * INCIDENTE del 6 de agosto de 2026, y por qué esta parte cambió.
 *
 * La primera versión hacía `policy || ${JSON.stringify(...)}::jsonb`. El driver
 * manda ese objeto como CADENA, Postgres la castea a un jsonb *string*, y
 * `objeto || string` **no fusiona: produce un ARREGLO de los dos**. La política
 * del Campus quedó como `[ {…original…}, "{\"kml…\":0.15}" ]` — el original
 * intacto en el elemento 0, pero la columna dejó de ser un objeto y
 * `contractPolicySchema` no la puede validar.
 *
 * Se restauró con `policy = policy->0`. Aquí van las tres correcciones:
 *
 *  1. **`jsonb_build_object`**, construido por la base. No hay cadena que
 *     castear ni forma que adivinar.
 *  2. **Guarda de forma**: si la política no es un objeto, no se toca.
 *  3. **Se comprueba DESPUÉS de escribir.** La versión anterior imprimía
 *     «✓ escrito» sin leer nada — un `UPDATE` cuyo resultado no se comprueba no
 *     es distinto de uno que no corrió. Regla 10, del lado de la escritura.
 */
for (const f of faltan) {
  const [antes] = await db`select jsonb_typeof(policy) tipo from service_contracts where id = ${f.id as string}`;
  if (antes?.tipo !== "object") {
    console.error(`  ✗ ${f.name}: la política es ${antes?.tipo}, no un objeto. No se toca.`);
    continue;
  }

  /*
   * FIRMA — C13, y es la corrección de este guion.
   *
   * La corrida del 6 de agosto de 2026 escribió la política del Campus a las
   * 09:14 y **no dejó una sola fila** en `contract_policy_history`. La tabla
   * existía desde el 31 de julio y `updatePolicy` ya la escribía; este guion
   * simplemente no pasa por ahí. Ése es el caso entero de C13: la historia
   * quedó vacía no porque nadie editara, sino porque quien editó entró por
   * otra puerta.
   *
   * Desde la migración 0020 el trigger escribe la fila pase por donde pase la
   * escritura. Lo que se agrega aquí es la FIRMA: sin declarar actor, esta
   * corrida quedaría registrada como `sql_directo`, que es verdad pero es
   * menos de lo que se sabe. Con esto queda claro qué guion fue.
   *
   * Va en la misma transacción que el UPDATE porque `set_config(..., true)` es
   * transaccional: fuera de una, no hay garantía de que la declaración y la
   * escritura viajen por la misma conexión.
   */
  await db.begin(async (tx) => {
    await tx`select set_config('jtel.actor_kind', 'guion:escribir-tolerancia-origen', true),
                    set_config('jtel.note', ${`${CAMPO} = ${VALOR_DE_FABRICA}, el mismo valor de fábrica que ya se aplicaba`}, true)`;
    await tx`update service_contracts
      set policy = policy || jsonb_build_object(${CAMPO}::text, ${VALOR_DE_FABRICA}::numeric),
          updated_at = now()
      where id = ${f.id as string} and jsonb_typeof(policy) = 'object'`;
  });

  const [d] = await db`select jsonb_typeof(policy) tipo,
      (policy->>${CAMPO})::numeric v,
      (select count(*) from jsonb_object_keys(policy))::int llaves
    from service_contracts where id = ${f.id as string}`;
  const ok = d?.tipo === "object" && Number(d.v) === VALOR_DE_FABRICA;
  console.log(`  ${ok ? "✓" : "✗"} ${f.name}: sigue siendo ${d?.tipo} · ${CAMPO}=${d?.v} · ${d?.llaves} llaves`);
  if (!ok) {
    console.error("\n  La comprobación posterior falló. Revisa antes de seguir.\n");
    await db.end();
    process.exit(1);
  }
}
console.log("");
await db.end();
