/**
 * ¿Cuántos servicios están en pendiente, por qué, y desde cuándo?
 *
 * SOLO LECTURA. Es el sensor de **observación contra conducta** del frente «ver
 * el instrumento, no solo el veredicto», en su mitad de medición — el tablero
 * espera al rediseño, igual que los otros dos.
 *
 * ---
 *
 * **Por qué existe.** `pendiente_evidencia` es el único «no claro» que llega al
 * cliente, y **no es un veredicto: es la ausencia de uno**. Su población decide
 * D3 —cuánto puede un servicio quedarse ahí y qué pasa después—, y esa cifra
 * **se mueve sola todos los días**: eran 100 el 4 de agosto, 104 el 5, 106 el 6.
 * **Una cifra de hace cinco días no sirve para tomar la decisión**, y ése es el
 * problema que este guion viene a quitar.
 *
 * **El eje, que es parte del resultado.** La causa NO vive en el hecho: vive en
 * el ledger, repartida en pasos distintos, y por eso contar «pendientes» a secas
 * y contar «pendientes por causa» dan números que no cuadran si uno se descuida:
 *
 *   · `cobertura_evidencia` → `insuficiente` — la evidencia no cubrió la ventana
 *     en el tiempo. **Es una compuerta de densidad que YA EXISTE**, en el eje
 *     temporal.
 *   · `decision` → `llegada_sin_atribucion` — llegó y no se pudo atribuir (C14).
 *   · `decision` → `observacion_insuficiente` — la ventana no alcanzó el origen
 *     de la ruta.
 *   · sin ninguno de los anteriores — el pendiente se dictó antes de llegar a
 *     esos pasos, típicamente por no haber evidencia que mirar.
 *
 * Se cuenta **el último asiento de cada ocurrencia**, no todos: una ocurrencia
 * re-verificada tiene varios, y sumarlos contaría el mismo servicio dos veces.
 *
 * **La antigüedad se mide desde la hora límite**, que es cuando el servicio
 * debió estar resuelto — no desde que se selló. Sellar tarde no vuelve joven a
 * un pendiente.
 *
 *   pnpm --filter @jtel/db medir-pendientes
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

type Fila = {
  contrato: string;
  turno: string;
  causa: string;
  n: number;
  mas_48h: number;
  mas_7d: number;
  horas_mediana: number | null;
  horas_max: number | null;
  mas_viejo: string;
};

const FMT = new Intl.NumberFormat("es-MX");

function num(n: number, d = 0): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Sin ella esta lectura correría con el usuario dueño.",
    );
  }

  const sql = postgres(url, { max: 1 });

  try {
    const filas = await sql<Fila[]>`
      WITH reales AS (
        SELECT sc.id, sc.name
          FROM service_contracts sc
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
      ),
      /*
       * Un solo asiento por ocurrencia: el más reciente **que haya juzgado**.
       *
       * No basta con «el más reciente», y esto ya produjo una cifra falsa: hay
       * asientos informativos —"llegada_fuera_ventana", por ejemplo— que se
       * escriben DESPUÉS del que decidió y no traen paso de decisión. Tomando el
       * último a secas, esas ocurrencias caían al cajón de «sin evidencia que
       * mirar» y lo inflaban de 5 a 34 **sin que nada se viera mal**: el total
       * seguía cuadrando y solo el reparto por causa mentía. Es la §D del Marco
       * —la agrupación— aplicada a una consulta.
       */
      ultimo AS (
        SELECT DISTINCT ON (le.service_occurrence_id)
               le.service_occurrence_id, le.steps
          FROM ledger_entries le
         WHERE EXISTS (
                 SELECT 1 FROM jsonb_array_elements(le.steps) s
                  WHERE s->>'step' IN ('decision', 'cobertura_evidencia', 'evidencia'))
         ORDER BY le.service_occurrence_id, le.created_at DESC
      ),
      pend AS (
        SELECT r.name                                   AS contrato,
               COALESCE(sh.name, '—')                   AS turno,
               o.id                                     AS ocurrencia_id,
               o.expected_deadline,
               EXTRACT(EPOCH FROM (NOW() - o.expected_deadline)) / 3600.0 AS horas,
               u.steps
          FROM compliance_facts cf
          JOIN service_occurrences o ON o.id = cf.service_occurrence_id
          JOIN reales r              ON r.id = o.contract_id
          LEFT JOIN route_shifts rs  ON rs.id = o.route_shift_id
          LEFT JOIN shifts sh        ON sh.id = rs.shift_id
          LEFT JOIN ultimo u         ON u.service_occurrence_id = o.id
         WHERE cf.status = 'pendiente_evidencia'
      ),
      clasificado AS (
        SELECT contrato, turno, horas, expected_deadline, ocurrencia_id,
               CASE
                 /*
                  * Dos diagnósticos distintos que NO se pueden juntar, y
                  * juntarlos fue el error: «nunca se juzgó» es un servicio sin
                  * historia, y «se juzgó y no encuentro el asiento» es un
                  * defecto de esta consulta. Un solo cajón para los dos
                  * convierte mi bug en dato de la operación.
                  */
                 WHEN NOT EXISTS (
                   SELECT 1 FROM ledger_entries le2
                    WHERE le2.service_occurrence_id = ocurrencia_id)
                   THEN 'nunca se juzgó (sin ledger)'
                 WHEN steps IS NULL THEN '⚠ con ledger y sin paso que juzgue'
                 WHEN EXISTS (
                   SELECT 1 FROM jsonb_array_elements(steps) s
                    WHERE s->>'step' = 'decision'
                      AND s->'details'->>'reason' = 'llegada_sin_atribucion')
                   THEN 'llegada_sin_atribucion'
                 WHEN EXISTS (
                   SELECT 1 FROM jsonb_array_elements(steps) s
                    WHERE s->>'step' = 'decision'
                      AND s->'details'->>'reason' = 'observacion_insuficiente')
                   THEN 'observacion_insuficiente'
                 WHEN EXISTS (
                   SELECT 1 FROM jsonb_array_elements(steps) s
                    WHERE s->>'step' = 'cobertura_evidencia'
                      AND s->>'result' = 'insuficiente')
                   THEN 'cobertura_insuficiente'
                 /*
                  * Cero puntos y retirado de la cola: es el único pendiente que
                  * NO es del árbitro sino del aparato. Se nombra aparte porque
                  * es el que D3 tiene que poder cerrar sin re-verificar nada —
                  * esperar no lo va a resolver.
                  */
                 WHEN EXISTS (
                   SELECT 1 FROM jsonb_array_elements(steps) s
                    WHERE s->>'step' = 'evidencia')
                   THEN 'sin evidencia posible'
                 ELSE '⚠ sin causa legible — revisar la consulta'
               END AS causa
          FROM pend
      )
      SELECT contrato, turno, causa,
             COUNT(*)::int                                              AS n,
             SUM(CASE WHEN horas > 48  THEN 1 ELSE 0 END)::int          AS mas_48h,
             SUM(CASE WHEN horas > 168 THEN 1 ELSE 0 END)::int          AS mas_7d,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY horas)         AS horas_mediana,
             MAX(horas)                                                 AS horas_max,
             TO_CHAR(MIN(expected_deadline), 'YYYY-MM-DD')              AS mas_viejo
        FROM clasificado
       GROUP BY 1,2,3
       ORDER BY 1,2,4 DESC`;

    if (filas.length === 0) {
      console.log(`\n  Cero pendientes en cuentas reales. Eso es una afirmación fuerte:\n` +
        `  comprobar que la verificación esté corriendo antes de celebrarlo.\n`);
      await sql.end();
      return;
    }

    const total = filas.reduce((s, f) => s + f.n, 0);
    const total48 = filas.reduce((s, f) => s + f.mas_48h, 0);
    const total7d = filas.reduce((s, f) => s + f.mas_7d, 0);

    console.log(`\n  Pendientes por evidencia — el insumo de D3`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · solo lectura · sin demo`);
    console.log(`  Antigüedad medida desde la HORA LÍMITE, no desde el sellado\n`);

    console.log(
      `  ${"contrato".padEnd(26)}${"turno".padEnd(16)}${"causa".padEnd(26)}` +
        `${"n".padStart(5)}${"> 48 h".padStart(8)}${"> 7 d".padStart(7)}` +
        `${"mediana".padStart(10)}${"máx".padStart(9)}   más viejo`,
    );
    for (const f of filas) {
      console.log(
        `  ${f.contrato.slice(0, 24).padEnd(26)}${f.turno.slice(0, 14).padEnd(16)}` +
          `${f.causa.padEnd(26)}${num(f.n).padStart(5)}${num(f.mas_48h).padStart(8)}` +
          `${num(f.mas_7d).padStart(7)}` +
          `${(f.horas_mediana === null ? "—" : num(Number(f.horas_mediana), 0) + " h").padStart(10)}` +
          `${(f.horas_max === null ? "—" : num(Number(f.horas_max) / 24, 0) + " d").padStart(9)}` +
          `   ${f.mas_viejo}`,
      );
    }

    console.log(
      `\n  TOTAL: ${FMT.format(total)} pendientes · ${FMT.format(total48)} de más de 48 h ` +
        `(${num((total48 / total) * 100, 1)} %) · ${FMT.format(total7d)} de más de 7 días\n`,
    );
    console.log(
      `  «pendiente por evidencia» NO es un veredicto: es la ausencia de uno. Un servicio\n` +
        `  aquí no está acusado de nada — y tampoco resuelto. Cuánto puede quedarse y qué\n` +
        `  pasa después es D3, y no se decide desde aquí.\n`,
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
