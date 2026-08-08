/**
 * INCIDENTE — restaura la política del contrato que quedó como arreglo.
 *
 * `escribir-tolerancia-origen.ts` hizo `policy || $1::jsonb` pasando el objeto
 * como CADENA. Postgres castea esa cadena a un jsonb *string*, y
 * `objeto || string` no fusiona: produce un ARREGLO de los dos. La política
 * original quedó intacta en el elemento 0, pero la columna dejó de ser un
 * objeto y `contractPolicySchema` no la puede validar.
 *
 * Esto devuelve la columna a `policy->0` — exactamente el estado anterior.
 * En seco por omisión.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
for (const p of ["../../.env", ".env"]) { if (existsSync(p)) { try { process.loadEnvFile(p); break } catch {} } }
const ejecutar = process.argv.includes("--ejecutar");
const db = postgres((ejecutar ? process.env.DATABASE_URL : process.env.DATABASE_URL_READONLY)!, { max:1, connect_timeout:20, idle_timeout:5 });

const rotos = await db`select id, name, jsonb_typeof(policy) tipo,
    jsonb_array_length(policy) largo, jsonb_typeof(policy->0) tipo0
  from service_contracts where jsonb_typeof(policy) = 'array'`;
console.log(`\n  ${ejecutar ? "EJECUTANDO" : "EN SECO"} · contratos con la política como arreglo: ${rotos.length}\n`);
for (const r of rotos) console.log(`  ${String(r.name).padEnd(44)} arreglo de ${r.largo} · elemento 0 es ${r.tipo0}`);
if (!rotos.length) { console.log("  Nada que restaurar.\n"); await db.end(); process.exit(0); }

const malos = rotos.filter(r => r.tipo0 !== "object" || Number(r.largo) !== 2);
if (malos.length) { console.error("\n  ALTO: algún caso no tiene la forma esperada. No se toca nada.\n"); await db.end(); process.exit(1); }

if (!ejecutar) { console.log("\n  Restauraría policy = policy->0 en los de arriba. Agrega --ejecutar\n"); await db.end(); process.exit(0); }
/*
 * FIRMA — C13. Una restauración es una edición de la política, y desde la
 * migración 0020 el trigger la registra pase por donde pase. Declarar el actor
 * es lo que la separa de un `sql_directo` anónimo: si algún día alguien lee la
 * historia de este contrato, la fila del incidente tiene que decir que fue un
 * arreglo y no una decisión de negocio.
 */
for (const r of rotos) {
  await db.begin(async (tx) => {
    await tx`select set_config('jtel.actor_kind', 'guion:restaurar-politica', true),
                    set_config('jtel.note', 'restauración del incidente: la política había quedado como arreglo', true)`;
    await tx`update service_contracts set policy = policy->0 where id = ${r.id as string} and jsonb_typeof(policy)='array'`;
  });
  console.log(`  ✓ restaurado ${r.name}`);
}
console.log("");
await db.end();
