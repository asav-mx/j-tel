/**
 * ¿Cuántos puntos manda el aparato, y cambió eso desde la última vez?
 *
 * SOLO LECTURA. Es el primer sensor del frente «ver el instrumento, no solo el
 * veredicto», y existe por un caso con fecha: el 29 de julio de 2026 la
 * densidad de muestreo de Planta 47 se multiplicó por ~1.5 y **la cobertura
 * del trazado saltó de 5–7 a 9.9 de 10 sin que nadie manejara distinto** (C19).
 * No fue un cambio nuestro y nadie se enteró: se supo once días después,
 * investigando otra cosa.
 *
 * Para qué sirve, con precisión, porque de eso depende que se use bien: es la
 * **precondición de medir C19**. Si se cambia la métrica de cobertura y el
 * número mejora, sin esto no hay forma de saber si fue el arreglo o el
 * proveedor moviendo la densidad otra vez. Se corre ANTES y DESPUÉS de cada PR
 * que toque la cobertura, y las dos corridas se guardan.
 *
 * ---
 *
 * **El eje, que es parte del resultado.** Hay tres cifras aquí y sólo una
 * responde «¿cambió el aparato?»:
 *
 *   · `puntos` — el total del día. Es la que cita la ficha de causas (§5.1 del
 *     PLAN), y por eso se imprime: para poder empalmar con lo ya medido. Pero
 *     **sube y baja con cuántos servicios hubo ese día**, así que un cambio
 *     suyo no acusa al aparato de nada.
 *   · `pts/apar` — el total repartido entre los aparatos que se vieron. Quita
 *     el tamaño de la flota y **no quita cuántas horas corrió cada uno**.
 *   · `hueco` — la mediana de los segundos entre dos puntos consecutivos del
 *     MISMO aparato dentro del MISMO viaje. **Ésta es la que hay que mirar**:
 *     no depende de cuántos servicios hubo, ni de cuántos aparatos, ni de
 *     cuánto corrió cada uno. Si el hueco se encoge, el aparato está mandando
 *     más seguido. Es la definición literal de cadencia.
 *
 * Se imprimen las tres a propósito. Una sola cifra «buena» sin las que la
 * componen es justo el caso 6 de §D del Marco: quien lee no puede reconstruir
 * el número con lo que tiene debajo.
 *
 * **Y una medida que se probó y se descartó, porque el descarte vale más que
 * la cifra:** la primera versión de esto medía *puntos por hora de ventana*.
 * Se ve razonable y está confundida: la ventana de evidencia es **derivada**
 * (C5), así que se mueve sola. El Campus del 10 de agosto de 2026 lo enseñó —
 * puntos normales, puntos por aparato normales, y la «cadencia» 34 % abajo. No
 * había mandado menos nadie: se había alargado el denominador. **Una medida
 * cuyo denominador es otra pieza en movimiento no mide el aparato, mide la
 * resta de las dos.** El hueco entre puntos no tiene denominador que se mueva.
 *
 * **Lo que este guion NO hace, y hay que decirlo:** no avisa. Detectar y
 * avisar son dos cosas (regla 16), y el tablero que avisaría vive en J-Staff y
 * espera al rediseño de pantallas. Mientras tanto la vigilancia es humana: hay
 * que correrlo.
 *
 * **Y no depende de que alguien lo haya corrido antes.** La serie se reconstruye
 * de `evidence_points`, que no se purgan —el único borrado cuelga de borrar un
 * viaje—, así que la historia de julio sigue disponible hoy. Por eso esto no
 * necesita tabla, ni migración, ni escribir nada.
 *
 * Excluye las cuentas demo (`is_demo`) por los dos lados, cliente y carrier:
 * Tecma es la única cuenta real.
 *
 *   pnpm --filter @jtel/db medir-cadencia [desde] [hasta]
 *
 * Fechas en `YYYY-MM-DD`, por día de servicio. Por omisión, los últimos 45
 * días. Va por `DATABASE_URL_READONLY`: una medición contra la base real no
 * debe poder tocar nada ni por accidente. Ver `verificar-solo-lectura.ts`.
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

type FilaDia = {
  contrato: string;
  fecha: string;
  ocurrencias: number;
  con_evidencia: number;
  aparatos: number;
  unidades: number;
  puntos: number;
  hueco_mediana_s: number | null;
  hueco_p90_s: number | null;
};

const FMT = new Intl.NumberFormat("es-MX");

function num(n: number, decimales = 0): string {
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

/**
 * El lunes de la semana de una fecha, en ISO. Se agrupa por semana porque la
 * pregunta del sensor es «¿cambió contra la semana pasada?», y un día suelto
 * no la contesta: los fines de semana tienen otra operación.
 */
export function lunesDe(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 domingo
  const retroceso = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - retroceso);
  return d.toISOString().slice(0, 10);
}

export type ResumenSemana = {
  lunes: string;
  dias: number;
  puntos: number;
  hueco: number | null;
  /** Porcentaje contra la semana previa CON dato. Negativo = muestreo más denso. */
  cambioPct: number | null;
};

/**
 * El resumen semanal, que es la pregunta del sensor.
 *
 * Se compara contra la última semana que TUVO dato, no contra la anterior en el
 * calendario: si una semana quedó sin medición, comparar contra su hueco nulo
 * daría «—» y escondería un cambio que sí ocurrió entre las dos que sí tienen.
 *
 * El signo importa y por eso se documenta aquí y no sólo al imprimir: el hueco
 * crece cuando el muestreo se ralea. **Un porcentaje positivo es peor**, que es
 * al revés de como se leen casi todas las métricas, y ésa es exactamente la
 * clase de inversión que produce una afirmación falsa con el dato correcto.
 */
export function resumirSemanas(
  filas: Array<{ fecha: string; puntos: number; hueco: number | null }>,
): ResumenSemana[] {
  const acumulado = new Map<string, { hueco: number[]; puntos: number; dias: number }>();
  for (const f of filas) {
    const k = lunesDe(f.fecha);
    const acc = acumulado.get(k) ?? { hueco: [], puntos: 0, dias: 0 };
    if (f.hueco !== null) acc.hueco.push(f.hueco);
    acc.puntos += f.puntos;
    acc.dias += 1;
    acumulado.set(k, acc);
  }

  const salida: ResumenSemana[] = [];
  let previa: number | null = null;
  for (const [lunes, acc] of [...acumulado].sort(([a], [b]) => a.localeCompare(b))) {
    const hueco =
      acc.hueco.length > 0 ? acc.hueco.reduce((s, n) => s + n, 0) / acc.hueco.length : null;
    const cambioPct =
      hueco !== null && previa !== null && previa > 0
        ? ((hueco - previa) / previa) * 100
        : null;
    salida.push({ lunes, dias: acc.dias, puntos: acc.puntos, hueco, cambioPct });
    if (hueco !== null) previa = hueco;
  }
  return salida;
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function haceDias(dias: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Es la credencial de solo lectura: sin ella, " +
        "esta medición correría con el usuario dueño contra producción.",
    );
  }

  const desde = process.argv[2] ?? haceDias(45);
  const hasta = process.argv[3] ?? hoyISO();
  for (const [nombre, valor] of [
    ["desde", desde],
    ["hasta", hasta],
  ] as const) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      throw new Error(`La fecha «${nombre}» debe ir en YYYY-MM-DD; llegó «${valor}».`);
    }
  }

  const sql = postgres(url, { max: 1 });

  try {
    /*
     * El hueco se calcula DENTRO de cada par (viaje × aparato) y nunca entre
     * pares: el salto del último punto de un viaje al primero del siguiente no
     * es un hueco de muestreo, es el tiempo entre dos servicios. Meterlo en la
     * mediana la contaminaría con la operación en vez del aparato.
     *
     * Se toma la mediana y no el promedio a propósito: un solo hueco largo
     * —un apagón del aparato, una unidad que entra a la geocerca y deja de
     * transmitir por ley— arrastra un promedio y no mueve una mediana. Aquí
     * interesa el ritmo normal, no los cortes; los cortes se ven en `puntos`.
     *
     * El p90 va al lado porque los dos juntos distinguen dos cosas que la
     * mediana sola no: bajar el ritmo (los dos suben) de volverse irregular
     * (sube el p90 y la mediana no).
     */
    const filas = await sql<FilaDia[]>`
      WITH reales AS (
        SELECT sc.id, sc.name
          FROM service_contracts sc
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
      ),
      ocurrencias AS (
        SELECT o.id, o.contract_id, o.service_date
          FROM service_occurrences o
          JOIN reales r ON r.id = o.contract_id
         WHERE o.service_date >= ${desde}::date
           AND o.service_date <= ${hasta}::date
      ),
      puntos AS (
        SELECT o.contract_id,
               o.service_date,
               o.id         AS ocurrencia_id,
               ep.trip_id,
               ep.imei,
               ep.unit_id,
               ep.recorded_at,
               LAG(ep.recorded_at) OVER (
                 PARTITION BY ep.trip_id, ep.imei ORDER BY ep.recorded_at
               )            AS previo
          FROM ocurrencias o
          JOIN trips t            ON t.service_occurrence_id = o.id
          JOIN evidence_points ep ON ep.trip_id = t.id
      ),
      dia_evidencia AS (
        SELECT contract_id,
               service_date,
               COUNT(DISTINCT ocurrencia_id)                 AS con_evidencia,
               COUNT(DISTINCT imei)                          AS aparatos,
               COUNT(DISTINCT unit_id)                       AS unidades,
               COUNT(*)                                      AS puntos,
               PERCENTILE_CONT(0.5) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM (recorded_at - previo)))  AS hueco_mediana_s,
               PERCENTILE_CONT(0.9) WITHIN GROUP (
                 ORDER BY EXTRACT(EPOCH FROM (recorded_at - previo)))  AS hueco_p90_s
          FROM puntos
         GROUP BY contract_id, service_date
      ),
      dia_total AS (
        SELECT contract_id, service_date, COUNT(*) AS ocurrencias
          FROM ocurrencias
         GROUP BY contract_id, service_date
      )
      SELECT r.name                                   AS contrato,
             TO_CHAR(dt.service_date, 'YYYY-MM-DD')   AS fecha,
             dt.ocurrencias::int                      AS ocurrencias,
             COALESCE(de.con_evidencia, 0)::int       AS con_evidencia,
             COALESCE(de.aparatos, 0)::int            AS aparatos,
             COALESCE(de.unidades, 0)::int            AS unidades,
             COALESCE(de.puntos, 0)::bigint           AS puntos,
             de.hueco_mediana_s                       AS hueco_mediana_s,
             de.hueco_p90_s                           AS hueco_p90_s
        FROM dia_total dt
        JOIN reales r ON r.id = dt.contract_id
        LEFT JOIN dia_evidencia de
               ON de.contract_id = dt.contract_id
              AND de.service_date = dt.service_date
       ORDER BY r.name, dt.service_date`;

    if (filas.length === 0) {
      console.log(
        `\n  Sin ocurrencias de cuentas reales entre ${desde} y ${hasta}.\n` +
          `  Eso no es «cero cadencia»: es que no hay de qué medirla.\n`,
      );
      await sql.end();
      return;
    }

    const contratos = [...new Set(filas.map((f) => f.contrato))];

    /*
     * El día de hoy y el de ayer pueden tener evidencia todavía en camino: el
     * archivador la trae después del servicio. Leerlos como «cayó la cadencia»
     * sería un dato correcto convertido en afirmación falsa por el alcance
     * (§D del Marco, caso 3), así que se marcan en vez de omitirse — omitirlos
     * escondería un día que sí puede haber caído.
     */
    const frescos = new Set([hoyISO(), haceDias(1)]);

    console.log(`\n  Cadencia del muestreo · por día de servicio`);
    console.log(`  Ventana: ${desde} → ${hasta} · solo cuentas reales (sin demo)`);
    console.log(`  Medido: ${new Date().toISOString()} (UTC) · usuario de solo lectura\n`);

    for (const contrato of contratos) {
      const delContrato = filas.filter((f) => f.contrato === contrato);
      console.log(`  ── ${contrato} ${"─".repeat(Math.max(0, 58 - contrato.length))}`);
      console.log(
        `  ${"fecha".padEnd(13)}${"ocurr".padStart(7)}${"c/evid".padStart(8)}` +
          `${"aparat".padStart(8)}${"unid".padStart(7)}${"puntos".padStart(11)}` +
          `${"pts/apar".padStart(10)}${"hueco s".padStart(10)}${"p90 s".padStart(9)}`,
      );

      for (const f of delContrato) {
        const puntos = Number(f.puntos);
        const porAparato = f.aparatos > 0 ? puntos / f.aparatos : null;
        const hueco = f.hueco_mediana_s === null ? null : Number(f.hueco_mediana_s);
        const p90 = f.hueco_p90_s === null ? null : Number(f.hueco_p90_s);
        const marca = frescos.has(f.fecha) ? "~" : " ";
        console.log(
          `  ${(f.fecha + marca).padEnd(13)}` +
            `${num(f.ocurrencias).padStart(7)}` +
            `${num(f.con_evidencia).padStart(8)}` +
            `${num(f.aparatos).padStart(8)}` +
            `${num(f.unidades).padStart(7)}` +
            `${FMT.format(puntos).padStart(11)}` +
            `${(porAparato === null ? "—" : num(porAparato)).padStart(10)}` +
            `${(hueco === null ? "—" : num(hueco, 1)).padStart(10)}` +
            `${(p90 === null ? "—" : num(p90, 1)).padStart(9)}`,
        );
      }

      console.log(`\n  semana de     días    puntos    hueco s   cambio vs. semana previa`);
      const semanas = resumirSemanas(
        delContrato.map((f) => ({
          fecha: f.fecha,
          puntos: Number(f.puntos),
          hueco: f.hueco_mediana_s === null ? null : Number(f.hueco_mediana_s),
        })),
      );
      for (const s of semanas) {
        let cambio = "—";
        if (s.cambioPct !== null) {
          // La flecha apunta a lo que le pasa al hueco; el rótulo dice qué
          // significa, porque un hueco que sube es muestreo que baja.
          const sentido = s.cambioPct > 1 ? "más ralo" : s.cambioPct < -1 ? "más denso" : "igual";
          const flecha = s.cambioPct > 0 ? "▲" : s.cambioPct < 0 ? "▼" : "·";
          cambio = `${flecha} ${num(Math.abs(s.cambioPct), 1)} % · ${sentido}`;
        }
        console.log(
          `  ${s.lunes.padEnd(13)}` +
            `${num(s.dias).padStart(4)}` +
            `${FMT.format(s.puntos).padStart(11)}` +
            `${(s.hueco === null ? "—" : num(s.hueco, 1)).padStart(10)}` +
            `   ${cambio}`,
        );
      }
      console.log("");
    }

    console.log(
      `  «hueco s» es la mediana de segundos entre dos puntos consecutivos del mismo\n` +
        `  aparato en el mismo viaje: es la cifra que acusa al aparato. Menos hueco =\n` +
        `  muestreo más denso. «puntos» empalma con §5.1 del PLAN y se mueve con\n` +
        `  cuántos servicios hubo, así que por sí sola no dice nada del muestreo.\n` +
        `  Las fechas con «~» pueden tener evidencia todavía en camino.\n`,
    );

    await sql.end();
  } catch (e) {
    await sql.end();
    throw e;
  }
}

// Sólo corre como guion; importado desde una prueba, no se conecta a nada.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
