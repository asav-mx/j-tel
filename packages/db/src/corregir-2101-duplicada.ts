/**
 * La 2101 duplicada de juarez-bus — corrección de captura del 18 sep 2026.
 *
 * El 18 de septiembre se instaló el TK-FTC927-004 en el camión 2101 y se dio de
 * alta una unidad NUEVA con ese número en lugar de usar la que ya existía. La
 * cuenta quedó con dos «2101»:
 *
 *   · 8136fba1… — la del 8 de julio: EL CAMIÓN, con su historia (≈40 mil puntos
 *     de telemetría, ≈92 mil de evidencia, ≈2 700 menciones en el ledger). Tiene
 *     todavía montado el Umbrella 864292043207933, de baja desde el 15 sep: la
 *     hoja de la baja de Umbrella no cerró su asignación.
 *   · f6686b64… — la de hoy, sin un solo dato; sólo la asignación del FTC-004.
 *
 * Decisión de ASAV (18 sep 2026): conservar la vieja y borrar la nueva.
 * No se borra lo que trajo datos (Marco 6.15); se borra la ficción.
 *
 * En UNA transacción, con las filas bloqueadas:
 *
 *   1. Comprueba que todo está exactamente como se leyó. Si algo cambió —y en
 *      particular si el FTC-004 alcanzó a archivar puntos con la unidad nueva—,
 *      se niega y no escribe nada. Esa situación no se improvisa: se reporta.
 *   2. Cierra la asignación colgada del Umbrella con la fecha de su baja.
 *   3. Pasa la asignación del FTC-004 a la 2101 vieja con la MISMA hora y el
 *      MISMO quién: es el mismo camión, así que corregir la fila no reescribe
 *      la historia, la endereza.
 *   4. Borra la 2101 nueva, que para entonces nada apunta a ella.
 *   5. Vuelve a comprobar el resultado antes del COMMIT.
 *
 * Sin `--aplicar` sólo lee, con `DATABASE_URL_READONLY`, e imprime lo que haría.
 *
 *   pnpm --filter @jtel/db exec tsx src/corregir-2101-duplicada.ts
 *   pnpm --filter @jtel/db exec tsx src/corregir-2101-duplicada.ts --aplicar
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

const CUENTA = "juarez-bus";
const VIEJA = "8136fba1-8824-461b-9f4d-ad6b9fd22730";
const NUEVA = "f6686b64-68e2-44e5-9154-2ffe7d8744fc";
const IMEI_UMBRELLA = "864292043207933";
const IMEI_FTC004 = "860693086787513";

type Sql = postgres.Sql | postgres.TransactionSql;

class Negativa extends Error {}

function exigir(condicion: boolean, porque: string): asserts condicion {
  if (!condicion) throw new Negativa(porque);
}

/** Todas las llaves foráneas hacia units(id), leídas del catálogo. */
async function llavesHaciaUnidades(sql: Sql) {
  return sql<{ tabla: string; columna: string }[]>`
    select cl.relname as tabla, att.attname as columna
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_attribute att on att.attrelid = c.conrelid and att.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'public.units'::regclass
    order by 1, 2`;
}

/** Qué apunta a una unidad: por llave foránea y por mención del id en el ledger. */
async function loQueApuntaA(sql: Sql, unitId: string) {
  const filas: { donde: string; n: number }[] = [];
  for (const fk of await llavesHaciaUnidades(sql)) {
    const [r] = await sql<{ n: number }[]>`
      select count(*)::int as n from ${sql(fk.tabla)} where ${sql(fk.columna)} = ${unitId}`;
    if (r!.n > 0) filas.push({ donde: `${fk.tabla}.${fk.columna}`, n: r!.n });
  }
  const [lg] = await sql<{ n: number }[]>`
    select count(*)::int as n from ledger_entries
    where steps::text like ${"%" + unitId + "%"} or metadata::text like ${"%" + unitId + "%"}`;
  if (lg!.n > 0) filas.push({ donde: "ledger_entries (mención del id)", n: lg!.n });
  return filas;
}

/** Lee y comprueba el estado de partida. Igual en simulación y al aplicar. */
async function leerYComprobar(sql: Sql, bloquear: boolean) {
  const [cuenta] = await sql<{ id: string }[]>`select id from accounts where slug = ${CUENTA}`;
  exigir(!!cuenta, `no existe la cuenta ${CUENTA}`);

  const unidades = bloquear
    ? await sql<{ id: string; label: string; carrier_account_id: string }[]>`
        select id::text, label, carrier_account_id::text from units where id in (${VIEJA}, ${NUEVA}) for update`
    : await sql<{ id: string; label: string; carrier_account_id: string }[]>`
        select id::text, label, carrier_account_id::text from units where id in (${VIEJA}, ${NUEVA})`;
  const vieja = unidades.find((u) => u.id === VIEJA);
  const nueva = unidades.find((u) => u.id === NUEVA);
  exigir(!!vieja, "la 2101 vieja ya no existe");
  exigir(!!nueva, "la 2101 nueva ya no existe (¿ya se corrió?)");
  for (const u of [vieja, nueva]) {
    exigir(u.carrier_account_id === cuenta.id, `la unidad ${u.id} no es de ${CUENTA}`);
    exigir(u.label.trim() === "2101", `la unidad ${u.id} ya no se llama 2101 («${u.label}»)`);
  }

  const asignaciones = await sql<{
    id: string; unit_id: string; imei: string; device_id: string; retired_at: Date | null;
    valid_from: Date; valid_to: Date | null; asignada_por: string | null;
  }[]>`
    select da.id::text, da.unit_id::text, dv.imei, dv.id::text as device_id, dv.retired_at,
           da.valid_from, da.valid_to, da.asignada_por
    from device_assignments da join devices dv on dv.id = da.device_id
    where da.unit_id in (${VIEJA}, ${NUEVA})
       or dv.imei in (${IMEI_UMBRELLA}, ${IMEI_FTC004})
    order by da.valid_from
    ${bloquear ? sql`for update of da` : sql``}`;

  // La vieja: una sola asignación, la del Umbrella, abierta, con el aparato de baja.
  const deVieja = asignaciones.filter((a) => a.unit_id === VIEJA);
  exigir(deVieja.length === 1, `la 2101 vieja tiene ${deVieja.length} asignaciones; se esperaba 1`);
  const umbrella = deVieja[0]!;
  exigir(umbrella.imei === IMEI_UMBRELLA, `la asignación de la vieja no es del Umbrella (${umbrella.imei})`);
  exigir(umbrella.valid_to === null, "la asignación del Umbrella ya está cerrada");
  exigir(umbrella.retired_at !== null, "el Umbrella ya no está de baja");

  // La nueva: una sola asignación, la del FTC-004, abierta.
  const deNueva = asignaciones.filter((a) => a.unit_id === NUEVA);
  exigir(deNueva.length === 1, `la 2101 nueva tiene ${deNueva.length} asignaciones; se esperaba 1`);
  const ftc = deNueva[0]!;
  exigir(ftc.imei === IMEI_FTC004, `la asignación de la nueva no es del FTC-004 (${ftc.imei})`);
  exigir(ftc.valid_to === null, "la asignación del FTC-004 ya está cerrada");

  // El FTC-004 no tiene otra asignación en ningún lado.
  const otrasDelFtc = asignaciones.filter((a) => a.imei === IMEI_FTC004 && a.id !== ftc.id);
  exigir(otrasDelFtc.length === 0, `el FTC-004 tiene ${otrasDelFtc.length} asignaciones más`);

  // La cerradura del Umbrella no puede quedar después de su apertura.
  exigir(
    umbrella.retired_at!.getTime() > umbrella.valid_from.getTime(),
    "la baja del Umbrella es anterior a su montaje",
  );

  // Lo que decide si se puede borrar: nada, salvo su asignación, apunta a la nueva.
  const apuntan = await loQueApuntaA(sql, NUEVA);
  const salvoSuAsignacion = apuntan
    .map((f) => (f.donde === "device_assignments.unit_id" ? { ...f, n: f.n - 1 } : f))
    .filter((f) => f.n > 0);

  // Puntos del FTC-004 archivados desde su montaje, con cualquier unidad.
  const [puntosDesdeMontaje] = await sql<{ n: number; con_nueva: number; ultimo: Date | null }[]>`
    select count(*)::int as n,
           count(*) filter (where unit_id = ${NUEVA})::int as con_nueva,
           max(recorded_at) as ultimo
    from telemetry_points where imei = ${IMEI_FTC004} and recorded_at >= ${ftc.valid_from}`;

  return { cuenta, umbrella, ftc, apuntan, salvoSuAsignacion, puntosDesdeMontaje: puntosDesdeMontaje! };
}

function imprimir(e: Awaited<ReturnType<typeof leerYComprobar>>) {
  console.log("  Estado leído:");
  console.log(`    Umbrella ${IMEI_UMBRELLA} en la 2101 vieja: abierta desde ${e.umbrella.valid_from.toISOString()}, de baja el ${e.umbrella.retired_at!.toISOString()}`);
  console.log(`    FTC-004 ${IMEI_FTC004} en la 2101 nueva: abierta desde ${e.ftc.valid_from.toISOString()}, asignada por ${e.ftc.asignada_por ?? "—"}`);
  console.log(`    Puntos del FTC-004 desde su montaje: ${e.puntosDesdeMontaje.n} (con la unidad nueva: ${e.puntosDesdeMontaje.con_nueva}; último: ${e.puntosDesdeMontaje.ultimo?.toISOString() ?? "ninguno"})`);
  console.log("    Lo que apunta a la 2101 nueva:");
  if (e.apuntan.length === 0) console.log("      nada");
  for (const f of e.apuntan) console.log(`      ${f.donde}: ${f.n}`);
  console.log("");
  console.log("  Lo que se escribe, en una transacción:");
  console.log(`    1. UPDATE device_assignments ${e.umbrella.id}: valid_to = ${e.umbrella.retired_at!.toISOString()} (la baja del Umbrella), cerrada_por = null (guion), motivo_cierre = «…»`);
  console.log(`    2. UPDATE device_assignments ${e.ftc.id}: unit_id ${NUEVA} → ${VIEJA} (valid_from y asignada_por sin tocar)`);
  console.log(`    3. DELETE units ${NUEVA}`);
  console.log("    4. Comprobación: la 2101 vieja con UNA vigente (el FTC-004) y una sola 2101 en la cuenta.");
}

const MOTIVO_UMBRELLA =
  "Cierre por corrección (18 sep 2026): el dispositivo estaba de baja desde esta fecha (Umbrella cortó el 5 sep) " +
  "y la hoja de la baja no cerró su asignación. Se cierra con la fecha de la baja.";

async function main() {
  const aplicar = pedirAplicar({
    guion: "corregir-2101-duplicada",
    queEscribe:
      "Cierra el Umbrella colgado de la 2101 vieja, le pasa la asignación del FTC-004 y borra la 2101 nueva de juarez-bus.",
    url: process.env.DATABASE_URL,
    alcance: { cuenta: CUENTA, conserva: VIEJA, borra: NUEVA },
  });

  const url = aplicar ? process.env.DATABASE_URL : process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error(aplicar ? "Falta DATABASE_URL" : "Falta DATABASE_URL_READONLY");
  const sql = postgres(url, { max: 1, connect_timeout: 30, idle_timeout: 5 });

  try {
    if (!aplicar) {
      const e = await leerYComprobar(sql, false);
      imprimir(e);
      if (e.salvoSuAsignacion.length > 0 || e.puntosDesdeMontaje.con_nueva > 0) {
        console.log("\n  ✗ SE NEGARÍA: la 2101 nueva ya tiene algo más que su asignación. No se borra; hay que decidir.");
        process.exitCode = 1;
      } else {
        console.log("\n  ✓ Todo como se esperaba: al aplicar, haría exactamente esto.");
      }
      return;
    }

    await sql.begin(async (tx) => {
      const e = await leerYComprobar(tx, true);
      imprimir(e);
      exigir(
        e.salvoSuAsignacion.length === 0 && e.puntosDesdeMontaje.con_nueva === 0,
        "la 2101 nueva ya tiene algo más que su asignación: " +
          JSON.stringify(e.salvoSuAsignacion) + ` · puntos con la nueva: ${e.puntosDesdeMontaje.con_nueva}`,
      );

      const r1 = await tx`
        update device_assignments
        set valid_to = ${e.umbrella.retired_at}, cerrada_por = null, motivo_cierre = ${MOTIVO_UMBRELLA}
        where id = ${e.umbrella.id} and valid_to is null`;
      exigir(r1.count === 1, `cerrar el Umbrella tocó ${r1.count} filas`);

      const r2 = await tx`
        update device_assignments set unit_id = ${VIEJA}
        where id = ${e.ftc.id} and unit_id = ${NUEVA} and valid_to is null`;
      exigir(r2.count === 1, `mover el FTC-004 tocó ${r2.count} filas`);

      exigir((await loQueApuntaA(tx, NUEVA)).length === 0, "después de mover, algo sigue apuntando a la nueva");
      const r3 = await tx`delete from units where id = ${NUEVA}`;
      exigir(r3.count === 1, `borrar la nueva tocó ${r3.count} filas`);

      const vigentes = await tx<{ imei: string }[]>`
        select dv.imei from device_assignments da join devices dv on dv.id = da.device_id
        where da.unit_id = ${VIEJA} and da.valid_to is null`;
      exigir(vigentes.length === 1 && vigentes[0]!.imei === IMEI_FTC004, "la 2101 vieja no quedó con el FTC-004 como única vigente");
      const [dos] = await tx<{ n: number }[]>`
        select count(*)::int as n from units where carrier_account_id = ${e.cuenta.id} and btrim(label) = '2101'`;
      exigir(dos!.n === 1, `quedan ${dos!.n} unidades 2101`);
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
