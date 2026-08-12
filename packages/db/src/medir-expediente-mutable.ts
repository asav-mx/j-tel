/**
 * ¿Cuánto de lo que el expediente muestra de un hecho SELLADO sale de filas
 * que alguien puede editar hoy?
 *
 * SOLO LECTURA. Es el insumo de la causa «el expediente de un hecho sellado no
 * es inmutable», y redimensiona el Tramo 4: si la ventana no era la única, la
 * lista de «lo que le falta cargar al hecho» está corta.
 *
 * ---
 *
 * **El patrón, que ya tiene nombre en este repo.** La
 * `Ficha-Diagnostico-Geocerca-No-Congelada` lo dijo del polígono: *lo que se
 * congela no se usa, y lo que se usa no se congela*. Esta corrida pregunta de
 * cuántos campos más es cierto, y **cuántos hechos ya divergen hoy** — porque
 * un campo que se lee vivo pero nunca cambió no ha hecho daño todavía, y uno
 * que ya cambió está mintiendo en pantalla ahora mismo.
 *
 * **Qué se compara.** Para cada hecho sellado, lo que `compliance_facts`
 * congeló contra lo que `service-detail-data.ts` va a leer al abrir la
 * pantalla:
 *
 *   política     `contract_policy_snapshot`  vs  `service_contracts.policy`
 *   hora límite  `compliance_facts.expected_deadline` vs la de la ocurrencia
 *   geocerca     `compliance_facts.expected_geofence_id` vs la del perfil
 *   unidad ref.  `compliance_facts.reference_unit_id` vs la de la ocurrencia
 *   trazado      `service_occurrences.kml_version_id` vs la que hoy resuelve
 *                `getKmlVersionForDate` por fecha
 *
 * ⚠ **Lo que esta corrida NO puede medir, y hay que decirlo porque es la parte
 * peor:** los campos **sin nada congelado enfrente** no tienen contra qué
 * compararse. La etiqueta y las placas de la unidad, el nombre del perfil, el
 * del contrato y el estado del viaje se leen vivos y **no existe copia dentro
 * del hecho**, así que un cambio ahí es indetectable por definición. **Cero
 * divergencias en esta tabla no significa cero daño: significa que de esos
 * campos no hay memoria.**
 *
 *   pnpm --filter @jtel/db medir-expediente-mutable
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import postgres from "postgres";

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
 * Las llaves de política que el expediente lee VIVAS, con qué cambia cada una
 * en pantalla y **con el default que la pantalla le aplica**.
 *
 * ⚠ **El default no es un adorno de esta tabla: es lo que separa una cifra
 * cierta de una falsa, y esta corrida ya cayó en la trampa.** La primera
 * versión comparaba los dos `jsonb` a secas y reportó **63 hechos con la zona
 * horaria divergente**. Es correcto como consulta y falso como afirmación: el
 * par es `null` congelado contra `"America/Ciudad_Juarez"` vivo, y el
 * expediente hace `policy.timeZone ?? "America/Ciudad_Juarez"` — o sea que los
 * dos lados **renderizan lo mismo** y en pantalla no cambia nada.
 *
 * Por eso se compara **lo que se vería**, no lo que está guardado: se aplica el
 * mismo default de `service-detail-data.ts` a los dos lados antes de comparar.
 * Es §D del Marco aplicada al propio instrumento.
 */
const LLAVES_QUE_EL_EXPEDIENTE_LEE = [
  ["toleranceMinutes", null, "el margen contra el que se dice «tarde»"],
  ["evidenceMarginMinutesBefore", null, "el «abre la observación» del renglón de ventana"],
  ["verificationGraceMinutes", null, "el «se espera antes de dictar»"],
  ["evidenceMarginMinutesAfter", null, "el «cierra la observación»"],
  ["timeZone", "America/Ciudad_Juarez", "la hora de TODOS los instantes del expediente"],
  ["enforcementRules", null, "las consecuencias económicas que se listan"],
] as const;

function num(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("es-MX");
}

function pct(parte: number, total: number): string {
  return total === 0 ? "—" : `${((parte / total) * 100).toFixed(1)} %`;
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) throw new Error("Falta DATABASE_URL_READONLY.");
  const sql = postgres(url, { max: 1 });

  try {
    console.log(`\n  El expediente contra el hecho — qué se lee vivo`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo\n`);

    const [{ hechos }] = await sql<Array<{ hechos: number }>>`
      SELECT COUNT(*)::int AS hechos
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false`;
    console.log(`  hechos sellados de contratos reales: ${num(hechos)}\n`);

    // ── 1 · La política: congelada en el hecho, leída viva por el expediente ──
    console.log(`  ── 1 · La política (el hecho la congela; el expediente lee la de hoy) ──`);
    console.log(
      `  ${"llave".padEnd(30)}${"jsonb".padStart(8)}${"EN PANTALLA".padStart(13)}   qué cambia`,
    );
    for (const [llave, porDefecto, efecto] of LLAVES_QUE_EL_EXPEDIENTE_LEE) {
      const [fila] = await sql<Array<{ crudo: number; visible: number }>>`
        SELECT
          SUM(CASE WHEN cf.contract_policy_snapshot -> ${llave}
                        IS DISTINCT FROM sc.policy -> ${llave}
                   THEN 1 ELSE 0 END)::int AS crudo,
          -- El mismo default que aplica la pantalla, a los dos lados.
          SUM(CASE WHEN COALESCE(cf.contract_policy_snapshot -> ${llave},
                                 TO_JSONB(${porDefecto}::text))
                        IS DISTINCT FROM
                        COALESCE(sc.policy -> ${llave}, TO_JSONB(${porDefecto}::text))
                   THEN 1 ELSE 0 END)::int AS visible
          FROM compliance_facts cf
          JOIN service_occurrences o ON o.id = cf.service_occurrence_id
          JOIN service_contracts sc ON sc.id = o.contract_id
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false`;
      const marca = fila!.visible > 0 ? "⚠" : " ";
      console.log(
        `${marca} ${llave.padEnd(30)}${num(fila!.crudo).padStart(8)}${num(fila!.visible).padStart(13)}   ${efecto}`,
      );
    }
    console.log(
      `\n  «jsonb» = los dos valores guardados difieren. «EN PANTALLA» = difieren\n` +
        `  DESPUÉS de aplicarles el default que la pantalla usa. Solo la segunda\n` +
        `  columna afirma algo sobre lo que un humano ve; la primera es el conteo\n` +
        `  que se ve bien y miente.\n`,
    );

    // ── 2 · Los campos con copia dentro del hecho ────────────────────────────
    const [comparables] = await sql<Array<{
      deadline: number; geocerca: number; unidad_ref: number;
    }>>`
      SELECT
        SUM(CASE WHEN cf.expected_deadline IS DISTINCT FROM o.expected_deadline
                 THEN 1 ELSE 0 END)::int AS deadline,
        SUM(CASE WHEN cf.expected_geofence_id IS DISTINCT FROM sp.geofence_id
                 THEN 1 ELSE 0 END)::int AS geocerca,
        SUM(CASE WHEN cf.reference_unit_id IS DISTINCT FROM o.reference_unit_id
                 THEN 1 ELSE 0 END)::int AS unidad_ref
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_profiles sp ON sp.id = o.service_profile_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false`;

    /*
     * El trazado: la ocurrencia GUARDA `kml_version_id` y el expediente no lo
     * lee — vuelve a resolver por fecha. Se reproduce aquí esa resolución
     * (`getKmlVersionForDate`: la vigente a la hora límite; si el KML se
     * cargó después del servicio, la más antigua) para ver si coinciden.
     */
    const [kml] = await sql<Array<{ con_id: number; difieren: number; sin_id: number }>>`
      WITH base AS (
        SELECT o.id, o.kml_version_id, o.expected_deadline, rs.route_id
          FROM compliance_facts cf
          JOIN service_occurrences o ON o.id = cf.service_occurrence_id
          JOIN route_shifts rs ON rs.id = o.route_shift_id
          JOIN service_contracts sc ON sc.id = o.contract_id
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
      ),
      resuelta AS (
        SELECT b.id, b.kml_version_id,
               COALESCE(
                 (SELECT v.id FROM route_kml_versions v
                   WHERE v.route_id = b.route_id
                     AND v.valid_from <= b.expected_deadline
                     AND (v.valid_to IS NULL OR v.valid_to >= b.expected_deadline)
                   ORDER BY v.valid_from DESC LIMIT 1),
                 (SELECT v.id FROM route_kml_versions v
                   WHERE v.route_id = b.route_id
                     AND v.valid_from > b.expected_deadline
                   ORDER BY v.valid_from ASC LIMIT 1)
               ) AS hoy
          FROM base b
      )
      SELECT SUM(CASE WHEN kml_version_id IS NOT NULL THEN 1 ELSE 0 END)::int AS con_id,
             SUM(CASE WHEN kml_version_id IS NOT NULL AND kml_version_id IS DISTINCT FROM hoy
                      THEN 1 ELSE 0 END)::int AS difieren,
             SUM(CASE WHEN kml_version_id IS NULL THEN 1 ELSE 0 END)::int AS sin_id
        FROM resuelta`;

    /*
     * Los pares concretos de las llaves que sí cambian en pantalla. Sin ellos,
     * «197 divergen» no se puede reconstruir: el lector no sabe si es un
     * cambio grande en pocos o uno chico en muchos.
     */
    const pares = await sql<Array<{
      contrato: string; llave: string; congelado: string; vivo: string; n: number;
      desde: string; hasta: string;
    }>>`
      SELECT sc.name AS contrato, 'evidenceMarginMinutesAfter' AS llave,
             COALESCE(cf.contract_policy_snapshot ->> 'evidenceMarginMinutesAfter', '—') AS congelado,
             COALESCE(sc.policy ->> 'evidenceMarginMinutesAfter', '—') AS vivo,
             COUNT(*)::int AS n,
             MIN(o.service_date)::text AS desde, MAX(o.service_date)::text AS hasta
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false
         AND cf.contract_policy_snapshot -> 'evidenceMarginMinutesAfter'
             IS DISTINCT FROM sc.policy -> 'evidenceMarginMinutesAfter'
       GROUP BY 1,2,3,4 ORDER BY 5 DESC`;
    if (pares.length > 0) {
      console.log(`  Los pares que sí mueven un renglón (congelado → vivo):`);
      for (const p of pares) {
        console.log(
          `    ${p.contrato.slice(0, 30).padEnd(32)}${p.llave.padEnd(28)}` +
            `${p.congelado.padStart(4)} → ${p.vivo.padEnd(5)}${num(p.n).padStart(5)}   ${p.desde} → ${p.hasta}`,
        );
      }
      console.log("");
    }

    console.log(`  ── 2 · Los campos que el hecho SÍ congela y el expediente no lee ──`);
    console.log(`  ${"campo".padEnd(30)}${"divergen".padStart(10)}${"".padStart(9)}qué se lee en su lugar`);
    const filas: Array<[string, number, string]> = [
      ["hora límite", comparables!.deadline, "`service_occurrences.expected_deadline`"],
      ["geocerca esperada", comparables!.geocerca, "el polígono VIVO del perfil"],
      ["unidad de referencia", comparables!.unidad_ref, "`service_occurrences.reference_unit_id`"],
      ["versión de trazado", kml!.difieren, "se re-resuelve por fecha, ignorando `kml_version_id`"],
    ];
    for (const [campo, n, fuente] of filas) {
      const marca = n > 0 ? "⚠" : " ";
      console.log(
        `${marca} ${campo.padEnd(30)}${num(n).padStart(9)}${pct(n, hechos).padStart(9)}   ${fuente}`,
      );
    }
    console.log(
      `\n  (trazado: ${num(kml!.con_id)} ocurrencias traen \`kml_version_id\` y ${num(kml!.sin_id)} no.\n` +
        `   Las que no lo traen no pueden divergir porque no hay contra qué comparar.)\n`,
    );

    // ── 3 · Lo que se lee vivo y NO tiene copia dentro del hecho ─────────────
    console.log(`  ── 3 · Lo que el expediente lee vivo y el hecho NO guarda ──────────`);
    console.log(
      `  Aquí no hay cifra que dar, y eso ES el hallazgo: sin copia congelada no\n` +
        `  existe divergencia detectable. Un cambio en cualquiera de éstos reescribe\n` +
        `  lo que el expediente de un hecho sellado dice, y no deja rastro:\n`,
    );
    for (const [campo, quien] of [
      ["ventana de evidencia", "`trips.evidence_window_start/end`"],
      ["etiqueta y placas de la unidad", "`units`, por id"],
      ["nombre del perfil de servicio", "`service_profiles.name`"],
      ["nombres de contrato, cliente, carrier y planta", "sus filas de catálogo"],
      ["estado de evidencia del viaje", "`trips.evidence_status`"],
      ["los puntos de evidencia", "`evidence_points` (se borran y se reescriben)"],
    ] as const) {
      console.log(`    ${campo.padEnd(46)}${quien}`);
    }

    // ── 4 · Y la prueba de que esto ya es incoherencia, no riesgo ────────────
    /*
     * Dos pantallas del mismo servicio leyendo tolerancias distintas: el cierre
     * y la tabla de ocurrencias leen `contract_policy_snapshot`; el expediente
     * lee la política viva. Mientras las dos coincidan nadie lo nota.
     */
    const [tol] = await sql<Array<{ n: number }>>`
      SELECT COUNT(*)::int AS n
        FROM compliance_facts cf
        JOIN service_occurrences o ON o.id = cf.service_occurrence_id
        JOIN service_contracts sc ON sc.id = o.contract_id
        JOIN accounts cli ON cli.id = sc.client_account_id
        JOIN accounts car ON car.id = sc.carrier_account_id
       WHERE cli.is_demo = false AND car.is_demo = false
         AND cf.contract_policy_snapshot -> 'toleranceMinutes'
             IS DISTINCT FROM sc.policy -> 'toleranceMinutes'`;
    console.log(
      `\n  ── 4 · Dos pantallas, dos tolerancias ─────────────────────────────\n` +
        `  El cierre y la tabla de ocurrencias leen la tolerancia CONGELADA; el\n` +
        `  expediente lee la VIVA. Hechos en los que hoy difieren: ${num(tol!.n)}.\n` +
        `  ${
          tol!.n === 0
            ? "Cero hoy — pero es cero porque nadie ha editado la política, no porque\n  las pantallas concuerden. El día que alguien la mueva, el mismo servicio\n  tendrá dos tolerancias según por dónde se entre."
            : "Ya difieren: el mismo servicio se explica de dos formas según la pantalla."
        }\n`,
    );

    await sql.end();
  } catch (e) {
    await sql.end();
    throw e;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
