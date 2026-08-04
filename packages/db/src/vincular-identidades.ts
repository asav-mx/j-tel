/**
 * Liga las identidades del seed con las que emite Clerk — Paso 2 de auth-rbac.
 *
 * La decisión, el mapeo y el plan viven en `mapeo-identidades.ts`. Esto es solo
 * lo que toca la base.
 *
 * SIMULACRO POR OMISIÓN. Sin `--aplicar` no escribe nada: imprime el plan y
 * sale. Misma disciplina que `corregir-deadlines`.
 *
 *   pnpm --filter @jtel/db vincular-identidades              # simulacro
 *   pnpm --filter @jtel/db vincular-identidades --sql        # imprime el SQL
 *   pnpm --filter @jtel/db vincular-identidades --aplicar    # escribe
 *
 * `--sql` existe por lo mismo que en `corregir-deadlines`: quien tiene permiso
 * de escritura sobre producción trabaja desde la consola de Neon, no desde una
 * terminal. El SQL lleva las mismas guardas dentro y queda como registro de qué
 * se insertó.
 *
 * **Nunca borra ni actualiza.** Deshacer es borrar las filas cuyo
 * `clerk_user_id` empieza por `user_`; ninguna fila existente se toca.
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema/index.js";
import type { Database } from "./index.js";
import { MembershipRepository } from "./repositories/index.js";
import {
  MAPEO,
  planDeVinculacion,
  validarVinculo,
  type FilaDeMembresia,
  type Vinculo,
} from "./mapeo-identidades.js";

let narrar = (l = "") => console.log(l);

export type PlanDeVinculo = {
  vinculo: Vinculo;
  /** Lo que hay que insertar. Vacío = ya estaba ligado. */
  faltan: FilaDeMembresia[];
  /** Cuántas del origen ya existían en el destino. */
  yaExistian: number;
  /** El origen no tiene ni una membresía: ligar no serviría de nada. */
  origenVacio: boolean;
};

export async function planear(db: Database, mapeo: Vinculo[] = MAPEO) {
  const repos = new MembershipRepository(db);
  const planes: PlanDeVinculo[] = [];

  for (const vinculo of mapeo) {
    const origen = await repos.findForUser(vinculo.desde);
    const destino = await repos.findForUser(vinculo.hacia);
    const faltan = planDeVinculacion(origen, destino);
    planes.push({
      vinculo,
      faltan,
      yaExistian: origen.length - faltan.length,
      origenVacio: origen.length === 0,
    });
  }

  return planes;
}

function comillear(v: string) {
  return `'${v.replace(/'/g, "''")}'`;
}

export function generarSql(planes: PlanDeVinculo[]): string {
  const L: string[] = [];
  L.push("BEGIN;");
  L.push("");
  for (const p of planes) {
    L.push(`-- ${p.vinculo.desde} → ${p.vinculo.hacia}  (${p.vinculo.nota})`);
    if (p.faltan.length === 0) {
      L.push("-- ya ligado, nada que insertar");
      L.push("");
      continue;
    }
    for (const f of p.faltan) {
      const scopeId = f.scopeId ? comillear(f.scopeId) : "NULL";
      L.push(
        `INSERT INTO user_memberships (account_id, clerk_user_id, role, scope_type, scope_id)`,
      );
      L.push(
        `SELECT ${comillear(f.accountId)}, ${comillear(p.vinculo.hacia)}, ${comillear(f.role)}, ${comillear(f.scopeType)}::scope_type, ${scopeId}`,
      );
      // La guarda va dentro del INSERT: si alguien corrió esto en medio, no
      // duplica. El índice único no lo impide cuando scope_id es NULL.
      L.push(`WHERE NOT EXISTS (`);
      L.push(`  SELECT 1 FROM user_memberships`);
      L.push(`  WHERE account_id = ${comillear(f.accountId)}`);
      L.push(`    AND clerk_user_id = ${comillear(p.vinculo.hacia)}`);
      L.push(`    AND role = ${comillear(f.role)}`);
      L.push(`    AND scope_type = ${comillear(f.scopeType)}::scope_type`);
      L.push(`    AND scope_id IS NOT DISTINCT FROM ${scopeId}`);
      L.push(`);`);
      L.push("");
    }
  }
  L.push("-- Comprueba el resultado antes de confirmar:");
  L.push("-- SELECT clerk_user_id, role, scope_type, scope_id FROM user_memberships");
  L.push("-- WHERE clerk_user_id LIKE 'user_%';");
  L.push("");
  L.push("-- Si cuadra:");
  L.push("-- COMMIT;");
  L.push("-- Si no:");
  L.push("-- ROLLBACK;");
  L.push("");
  return L.join("\n");
}

export async function correr(
  db: Database,
  { aplicar, soloSql }: { aplicar: boolean; soloSql: boolean },
) {
  if (soloSql) narrar = (l = "") => console.error(l);

  narrar(`\n${"=".repeat(76)}`);
  const modo = soloSql
    ? "SQL PARA LA CONSOLA (no escribe nada)"
    : aplicar
      ? "APLICANDO"
      : "SIMULACRO (no escribe nada)";
  narrar(`  MAPEO DE IDENTIDAD — ${modo}`);
  narrar(`${"=".repeat(76)}`);

  if (MAPEO.length === 0) {
    narrar(`\n  El mapeo está vacío: no hay ninguna identidad de Clerk que ligar.`);
    narrar(`  Se llena en packages/db/src/mapeo-identidades.ts, una línea por persona.\n`);
    return { insertadas: 0 };
  }

  // Falla cerrado y ANTES de tocar la base: un vínculo mal escrito reparte
  // permisos sobre una cuenta de cliente real.
  const malos = MAPEO.map((v) => [v, validarVinculo(v)] as const).filter(([, p]) => p !== null);
  if (malos.length > 0) {
    for (const [v, problema] of malos) {
      narrar(`\n  ✗ ${v.desde} → ${v.hacia}: ${problema}`);
    }
    throw new Error(`El mapeo tiene ${malos.length} vínculo(s) inválido(s). No se tocó nada.`);
  }

  const planes = await planear(db);

  for (const p of planes) {
    narrar(`\n  ${p.vinculo.desde} → ${p.vinculo.hacia}`);
    narrar(`  ${p.vinculo.nota}`);
    if (p.origenVacio) {
      narrar(`     ⚠ el origen no tiene ninguna membresía — ligar no haría nada`);
      continue;
    }
    if (p.faltan.length === 0) {
      narrar(`     ya ligado (${p.yaExistian} membresía(s))`);
      continue;
    }
    for (const f of p.faltan) {
      const alcance = f.scopeId ? `${f.scopeType}:${f.scopeId.slice(0, 8)}` : f.scopeType;
      narrar(`     + ${f.role} · alcance ${alcance} · cuenta ${f.accountId.slice(0, 8)}`);
    }
    if (p.yaExistian > 0) narrar(`     (${p.yaExistian} ya existían)`);
  }

  if (soloSql) {
    narrar(`\n  (el SQL va a stdout; este resumen va a stderr)\n`);
    console.log(generarSql(planes));
    return { insertadas: 0 };
  }

  const aInsertar = planes.reduce((n, p) => n + p.faltan.length, 0);

  if (!aplicar) {
    narrar(`\n  SIMULACRO. No se escribió nada. Agrega --aplicar para ejecutar.`);
    narrar(`  Filas que insertaría: ${aInsertar}\n`);
    return { insertadas: 0 };
  }

  const repos = new MembershipRepository(db);
  let insertadas = 0;
  for (const p of planes) {
    if (p.origenVacio || p.faltan.length === 0) continue;
    const r = await repos.vincular(p.vinculo.desde, p.vinculo.hacia);
    insertadas += r.insertadas.length;
  }

  narrar(`\n  membresías insertadas: ${insertadas}`);
  narrar(`  ninguna fila existente se modificó ni se borró\n`);
  return { insertadas };
}

export async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const soloSql = process.argv.includes("--sql");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");

  const cliente = postgres(url, { max: 1 });
  const db = drizzle(cliente, { schema }) as unknown as Database;
  try {
    await correr(db, { aplicar, soloSql });
  } finally {
    await cliente.end();
  }
}

// Solo corre si se invoca directamente, no al importarlo desde una prueba.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
