/**
 * Cierra las asignaciones que siguen abiertas aunque su dispositivo ya está de
 * baja — con la fecha de la baja.
 *
 * La hoja de la baja de Umbrella (`docs/correcciones/2026-09-15-aplicar-0036-
 * y-baja-de-umbrella.sql`) marcó los 82 aparatos pero no cerró sus
 * asignaciones. Contado el 18 sep 2026: **77** siguen «montados» en su unidad.
 * La flota lo acusa como anomalía («de baja y montado») y un coordinador ve la
 * unidad como si todavía trajera ese aparato. La asignación no siguió viva
 * después de que el aparato murió: la fecha verdadera de su cierre es la de la
 * baja (ASAV, 18 sep 2026). Es la misma regla con la que se cerró el de la 2101
 * (`corregir-2101-duplicada.ts`).
 *
 * Desde C4-a, dar de baja desde la pantalla ya cierra la asignación en la misma
 * transacción (`procedeBaja`). Esto limpia lo que quedó de antes.
 *
 * Se niega, sin escribir nada, si alguna asignación:
 *   · se abrió en o después de la baja (cerrarla dejaría el fin antes del inicio);
 *   · tiene puntos archivados con su unidad después de la baja (cerrarla los
 *     dejaría fuera de su propia asignación);
 *   · comparte unidad con otra asignación vigente.
 *
 * Sin `--aplicar` sólo lee, con `DATABASE_URL_READONLY`, y dice qué cerraría.
 *
 *   pnpm --filter @jtel/db exec tsx src/cerrar-asignaciones-de-baja.ts
 *   pnpm --filter @jtel/db exec tsx src/cerrar-asignaciones-de-baja.ts --aplicar
 */
import { existsSync } from "node:fs";
import postgres from "postgres";
import { pedirAplicar } from "./permiso-de-escritura.js";

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

const MOTIVO =
  "Cierre por corrección (18 sep 2026): el dispositivo se dio de baja en esta fecha y la hoja de la baja " +
  "no cerró su asignación. Se cierra con la fecha de la baja.";

type Sql = postgres.Sql | postgres.TransactionSql;

class Negativa extends Error {}

async function leer(sql: Sql, bloquear: boolean) {
  const colgadas = await sql<{
    id: string; slug: string; unidad: string; imei: string; nombre: string | null;
    valid_from: Date; retired_at: Date;
  }[]>`
    select da.id::text, a.slug, u.label as unidad, d.imei, d.label as nombre, da.valid_from, d.retired_at
    from device_assignments da
    join devices d on d.id = da.device_id
    join units u on u.id = da.unit_id
    join accounts a on a.id = d.carrier_account_id
    where da.valid_to is null and d.retired_at is not null
    order by a.slug, u.label
    ${bloquear ? sql`for update of da` : sql``}`;

  const [despues] = await sql<{ n: number }[]>`
    select count(*)::int as n from device_assignments da join devices d on d.id = da.device_id
    where da.valid_to is null and d.retired_at is not null and da.valid_from >= d.retired_at`;
  const [puntos] = await sql<{ n: number }[]>`
    select count(*)::int as n from telemetry_points tp
    join devices d on d.imei = tp.imei and d.carrier_account_id = tp.carrier_account_id
    join device_assignments da on da.device_id = d.id and da.valid_to is null
    where d.retired_at is not null and tp.recorded_at >= d.retired_at and tp.unit_id = da.unit_id`;
  const [dobles] = await sql<{ n: number }[]>`
    select count(*)::int as n from device_assignments da join devices d on d.id = da.device_id
    where da.valid_to is null and d.retired_at is not null
      and exists (select 1 from device_assignments o where o.unit_id = da.unit_id and o.valid_to is null and o.id <> da.id)`;

  return { colgadas, despues: despues!.n, puntos: puntos!.n, dobles: dobles!.n };
}

function imprimir(e: Awaited<ReturnType<typeof leer>>) {
  const porCuenta = new Map<string, number>();
  for (const c of e.colgadas) porCuenta.set(c.slug, (porCuenta.get(c.slug) ?? 0) + 1);
  console.log(`  Asignaciones abiertas con el dispositivo de baja: ${e.colgadas.length}`);
  for (const [slug, n] of porCuenta) console.log(`    ${slug}: ${n}`);
  console.log(`  Abiertas en o después de la baja: ${e.despues} · con puntos después de la baja: ${e.puntos} · unidad con otra vigente: ${e.dobles}`);
  for (const c of e.colgadas.slice(0, 5)) {
    console.log(`    p. ej. unidad ${c.unidad} · ${c.nombre ?? "sin nombre"} ${c.imei} · desde ${c.valid_from.toISOString()} → se cierra el ${c.retired_at.toISOString()}`);
  }
  if (e.colgadas.length > 5) console.log(`    … y ${e.colgadas.length - 5} más`);
}

function comprobar(e: Awaited<ReturnType<typeof leer>>) {
  if (e.despues > 0) throw new Negativa(`${e.despues} se abrieron en o después de su baja`);
  if (e.puntos > 0) throw new Negativa(`${e.puntos} puntos quedarían fuera de su asignación`);
  if (e.dobles > 0) throw new Negativa(`${e.dobles} comparten unidad con otra asignación vigente`);
}

async function main() {
  const aplicar = pedirAplicar({
    guion: "cerrar-asignaciones-de-baja",
    queEscribe: "Cierra, con la fecha de la baja, las asignaciones que siguen abiertas con el dispositivo de baja.",
    url: process.env.DATABASE_URL,
  });
  const url = aplicar ? process.env.DATABASE_URL : process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error(aplicar ? "Falta DATABASE_URL" : "Falta DATABASE_URL_READONLY");
  const sql = postgres(url, { max: 1, connect_timeout: 30, idle_timeout: 5 });

  try {
    if (!aplicar) {
      const e = await leer(sql, false);
      imprimir(e);
      try {
        comprobar(e);
        console.log(`\n  ✓ Al aplicar cerraría ${e.colgadas.length}, cada una con la fecha de la baja de su dispositivo.`);
      } catch (err) {
        console.log(`\n  ✗ SE NEGARÍA: ${(err as Error).message}`);
        process.exitCode = 1;
      }
      return;
    }

    await sql.begin(async (tx) => {
      const e = await leer(tx, true);
      imprimir(e);
      comprobar(e);
      const r = await tx`
        update device_assignments da
        set valid_to = d.retired_at, cerrada_por = null, motivo_cierre = ${MOTIVO}
        from devices d
        where d.id = da.device_id and da.valid_to is null and d.retired_at is not null`;
      if (r.count !== e.colgadas.length) {
        throw new Negativa(`se cerraron ${r.count} y se leyeron ${e.colgadas.length}`);
      }
      const despues = await leer(tx, false);
      if (despues.colgadas.length !== 0) throw new Negativa(`quedaron ${despues.colgadas.length} abiertas`);
    });
    console.log("\n  ✓ Aplicado. COMMIT.");
  } catch (err) {
    if (err instanceof Negativa) {
      console.error(`\n  ✗ SE NIEGA, sin escribir nada: ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  } finally {
    await sql.end();
  }
}

main();
