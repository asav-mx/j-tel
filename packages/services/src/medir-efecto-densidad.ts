/**
 * ¿Cuánta cobertura se pierde solo por muestrear menos? — el grupo de control de C19.
 *
 * SOLO LECTURA. No sella, no re-verifica, no escribe, no toca el motor de
 * producción. Lee evidencia ya guardada y vuelve a calcular una cifra sobre
 * ella, en memoria.
 *
 * ---
 *
 * **Por qué existe.** C19 dice que la cobertura del trazado depende de la
 * densidad del muestreo y no de la conducta. Lo que había hasta hoy era una
 * **correlación con fecha**: el 29 de julio de 2026 la cadencia de Planta 47
 * pasó de un punto cada 60 s a uno cada ~40 s, y la cobertura saltó de 5–7 a
 * 9.9 de 10. Nadie manejó distinto. Pero *«cambiaron las dos cosas a la vez»*
 * no es *«una causó la otra»* — y en este proyecto tres conclusiones ya
 * murieron por esa diferencia.
 *
 * **El método es el que mató el rumbo espurio** (§4 del reporte de los 71): se
 * toma un día bueno y **se adelgaza hasta la densidad del día malo**. Todo lo
 * demás queda fijo —la misma unidad, el mismo trazado, el mismo recorrido, el
 * mismo día, la misma geometría—, así que **lo único que cambia es cuántos
 * puntos hay**. Si la cobertura cae, cayó por la densidad. No hay otra variable
 * a la que atribuírselo.
 *
 * **El grupo de control importa más que el hallazgo** (regla 9): una causa no se
 * acredita contra las que fallan sino **contra las que pasan**. Por eso la
 * comparación es **pareada sobre las candidatas que acreditan hoy** — las mismas
 * candidatas antes y después de adelgazar, no dos poblaciones puestas una al
 * lado de la otra. Si adelgazar tumba a las que pasan, ése es el resultado.
 *
 * ---
 *
 * **Cómo adelgaza, y por qué así.** Se recorre la evidencia de cada aparato en
 * orden y se conserva un punto solo si pasaron al menos N segundos desde el
 * último conservado. Es lo que hace un aparato que emite cada N segundos, no un
 * muestreo al azar: **el azar produciría huecos irregulares y aquí el fenómeno
 * es un intervalo fijo.** El 60 sale medido, no elegido: es exactamente la
 * mediana del hueco de Planta 47 durante los trece días de servicio del 9 al 28
 * de julio.
 *
 * **Qué se mide, y contra qué waypoints — que es donde se decide si esto
 * atribuye o solo describe.** Se mide contra los **waypoints crudos del KML**,
 * no contra el tramo que `observableRouteSpan` considera observable. Es a
 * propósito: el tramo observable **se deriva de los propios puntos**, así que al
 * adelgazar cambiaría también él y la corrida tendría **dos variables
 * moviéndose**. Contra el KML crudo, la única diferencia entre las dos corridas
 * es la densidad.
 *
 * **La contra, dicha porque el eje es parte del resultado:** esta cifra **no es
 * la que el motor sella** —el motor sí aplica el tramo observable—, así que
 * sirve para **atribuir el efecto** y no para decir qué habría salido en
 * producción. Lo segundo es simulación.
 *
 * ---
 *
 * **Las TRES métricas, y por qué van juntas.** La pregunta que esto contesta no
 * es solo «¿cuánto cae la cobertura?» sino **«¿alguna forma de medir aguanta el
 * cambio de densidad?»** — de eso depende que el arreglo de C19 sea solo un piso
 * o un piso más una métrica nueva. Así que cada peldaño se mide tres veces:
 *
 *   · **A ponderada** (`computeWeightedRouteMatchPct`) — **la que decide hoy**.
 *     Pesa cada segmento por IDF sobre el corpus de rutas del contrato, para que
 *     dos rutas que comparten avenida no se confundan.
 *   · **A llana** (`computeRouteMatchPct`) — «qué fracción del trazado se
 *     cubrió», a secas. Es la de C17, la que el expediente debe enseñar.
 *   · **B** (`computeCorridorPrecisionPct`) — qué fracción de los PUNTOS cae en
 *     el corredor. **Es una razón sobre los puntos**, así que se espera que
 *     apenas se mueva al adelgazar; medirlo es lo que convierte esa expectativa
 *     en dato.
 *
 * ⚠ **Y una corrección al primer uso de este guion, que hay que decir:** las
 * corridas del 11 de agosto midieron **la llana**, no la ponderada. La ficha las
 * llamó «cobertura» a secas. **No invalida su conclusión** —el efecto de la
 * densidad se ve en las dos, y ahora se puede comparar— pero **el rótulo era
 * impreciso justo en el eje que más importa aquí.**
 *
 * **Lo que este guion NO puede decir:** si la cobertura recuperada movería un
 * veredicto. Eso exige volver a correr el motor entero —atribución, empate
 * entre candidatas, sellado— y eso es **simulación**: D4 / Tramo 6, con
 * decisión de Asav. Aquí solo se mide el término.
 *
 *   pnpm --filter @jtel/services medir-efecto-densidad [contrato] [desde] [hasta]
 *
 * Va por `DATABASE_URL_READONLY`. Ver `verificar-solo-lectura.ts`.
 */
import { existsSync } from "node:fs";
import { sql } from "drizzle-orm";
import { createDb } from "@jtel/db";
import type { ContractPolicy, GpsPoint } from "@jtel/domain";
import {
  buildSegmentIdf,
  computeCorridorPrecisionPct,
  computeRouteMatchPct,
  computeWeightedRouteMatchPct,
} from "@jtel/verification";

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

/** Los peldaños de adelgazamiento, en segundos. El 60 es el régimen viejo medido. */
const PELDANOS = [40, 60, 120] as const;

type Waypoint = { lat: number; lng: number };

/** Las tres formas de medir lo mismo, que es de lo que trata esta corrida. */
type Metricas = { ponderada: number; llana: number; corredor: number };

type Candidata = {
  ocurrencia: string;
  fecha: string;
  ruta: string;
  unidad: string | null;
  imei: string;
  puntos: GpsPoint[];
};

/**
 * Conserva un punto solo si pasaron `segundos` desde el último conservado.
 *
 * Determinista y sin azar a propósito: dos corridas sobre los mismos datos dan
 * el mismo resultado, que es lo que permite comparar antes y después. Un
 * muestreo aleatorio daría una cifra distinta cada vez y ninguna comparación
 * sería atribuible.
 */
export function adelgazar(puntos: GpsPoint[], segundos: number): GpsPoint[] {
  if (puntos.length === 0) return [];
  const orden = [...puntos].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const salida: GpsPoint[] = [orden[0]!];
  let ultimo = orden[0]!.timestamp.getTime();
  for (const p of orden.slice(1)) {
    const t = p.timestamp.getTime();
    if (t - ultimo >= segundos * 1000) {
      salida.push(p);
      ultimo = t;
    }
  }
  return salida;
}

/** Mediana, para no dejar que un caso raro mueva el resumen. */
function mediana(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function num(n: number, d = 1): string {
  return n.toLocaleString("es-MX", { minimumFractionDigits: d, maximumFractionDigits: d });
}

async function main() {
  const url = process.env.DB_URL ?? process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL_READONLY. Sin ella esta medición correría con el usuario dueño.",
    );
  }

  const filtroContrato = process.argv[2] ?? "Tecma 47";
  const desde = process.argv[3] ?? "2026-07-30";
  const hasta = process.argv[4] ?? "2026-08-11";

  const db = createDb(url);

  {
    /*
     * Una fila por (ocurrencia × aparato). Se agrupa por aparato y no por
     * unidad porque el adelgazamiento imita a un APARATO emitiendo más
     * despacio, y un aparato es el que tiene cadencia. La unidad va al lado
     * para poder leerlo (Ley 5 del Marco: son cosas distintas).
     */
    const filas = await db.execute(sql`
      WITH reales AS (
        SELECT sc.id, sc.name, sc.policy
          FROM service_contracts sc
          JOIN accounts cli ON cli.id = sc.client_account_id
          JOIN accounts car ON car.id = sc.carrier_account_id
         WHERE cli.is_demo = false AND car.is_demo = false
           AND sc.name ILIKE ${"%" + filtroContrato + "%"}
      )
      SELECT o.id                                   AS ocurrencia_id,
             TO_CHAR(o.service_date, 'YYYY-MM-DD')  AS fecha,
             r.name                                 AS ruta,
             c.name                                 AS contrato,
             c.policy                               AS policy,
             kv.waypoints                           AS waypoints,
             u.label                                AS unidad,
             ep.imei                                AS imei,
             ARRAY_AGG(ep.latitude  ORDER BY ep.recorded_at) AS lat,
             ARRAY_AGG(ep.longitude ORDER BY ep.recorded_at) AS lng,
             ARRAY_AGG(TO_CHAR(ep.recorded_at AT TIME ZONE 'UTC',
                               'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                       ORDER BY ep.recorded_at)     AS ts
        FROM service_occurrences o
        JOIN reales c            ON c.id = o.contract_id
        JOIN route_shifts rs     ON rs.id = o.route_shift_id
        JOIN routes r            ON r.id = rs.route_id
        JOIN route_kml_versions kv ON kv.id = o.kml_version_id
        JOIN trips t             ON t.service_occurrence_id = o.id
        JOIN evidence_points ep  ON ep.trip_id = t.id
        LEFT JOIN units u        ON u.id = ep.unit_id
       WHERE o.service_date >= ${desde}::date
         AND o.service_date <= ${hasta}::date
         AND JSONB_ARRAY_LENGTH(kv.waypoints) > 1
       GROUP BY o.id, o.service_date, r.name, c.name, c.policy, kv.waypoints, u.label, ep.imei
      HAVING COUNT(*) >= 10
       ORDER BY o.service_date, r.name, ep.imei`);

    const candidatas: Candidata[] = [];
    let politica: ContractPolicy | null = null;
    const waypointsPorOcurrencia = new Map<string, Waypoint[]>();

    for (const fila of filas as unknown as Array<Record<string, unknown>>) {
      politica ??= fila.policy as ContractPolicy;
      const ocurrencia = String(fila.ocurrencia_id);
      waypointsPorOcurrencia.set(ocurrencia, fila.waypoints as Waypoint[]);
      const lat = fila.lat as number[];
      const lng = fila.lng as number[];
      const ts = fila.ts as string[];
      const imei = String(fila.imei);
      candidatas.push({
        ocurrencia,
        fecha: String(fila.fecha),
        ruta: String(fila.ruta),
        unidad: fila.unidad === null ? null : String(fila.unidad),
        imei,
        puntos: lat.map((la, i) => ({
          latitude: Number(la),
          longitude: Number(lng[i]),
          timestamp: new Date(ts[i]!),
          imei,
        })),
      });
    }

    if (candidatas.length === 0) {
      console.log(
        `\n  Sin candidatas para «${filtroContrato}» entre ${desde} y ${hasta}.\n` +
          `  Eso no es «la densidad no afecta»: es que no hay sobre qué medirlo.\n`,
      );
      return;
    }

    /*
     * El corpus de rutas del contrato, que es lo que da el peso IDF. El motor lo
     * arma igual: sin corpus no hay ponderación y `routeMatchPct` cae a la
     * llana, así que reproducirlo es lo único que permite medir **la métrica que
     * de verdad decide** y no una parecida.
     */
    const corpus = [...waypointsPorOcurrencia.values()];
    const vistos = new Set<string>();
    const corpusUnico = corpus.filter((w) => {
      const clave = `${w.length}:${w[0]?.lat},${w[0]?.lng}:${w[w.length - 1]?.lat}`;
      if (vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    });
    const idf = buildSegmentIdf(corpusUnico);

    const corredorKm = (politica?.kmlCorridorMeters ?? 120) / 1000;
    /*
     * El umbral de A es `kmlMatchMinPct`, NO `kmlCorridorMinPct`.
     *
     * Va comentado porque la primera versión de esto usó el segundo y la cifra
     * salió bien de todos modos para Planta 47 —los tiene los dos en 60— y mal
     * para el Campus, que tiene 60 y 50. **Un umbral equivocado que coincide en
     * un contrato no se ve mal en ningún lado**: la corrida termina, imprime un
     * número plausible y solo el otro contrato lo delata.
     *
     *   kmlMatchMinPct     → A, cobertura del trazado  ← el de aquí
     *   kmlCorridorMinPct  → B, precisión de corredor
     */
    const umbral = politica?.kmlMatchMinPct ?? 60;
    /*
     * El umbral de B se puede sobrescribir por argumento, y no es una comodidad:
     * es C16. El Campus corre `kmlCorridorMinPct` en 50 y la Planta confirmó el
     * 12 de agosto que lo pactado era **60**. Poder correr la misma medición
     * contra **lo configurado** y contra **lo acordado** es la única forma de
     * poner número a «el árbitro está aplicando una regla que nadie pactó».
     */
    const umbralArg = process.argv[5] === undefined ? null : Number(process.argv[5]);
    if (umbralArg !== null && !Number.isFinite(umbralArg)) {
      throw new Error(`El umbral de corredor debe ser un número; llegó «${process.argv[5]}».`);
    }
    const umbralConfigurado = politica?.kmlCorridorMinPct ?? 60;
    const umbralCorredor = umbralArg ?? umbralConfigurado;

    console.log(`\n  Efecto de la densidad sobre la cobertura — grupo de control de C19`);
    console.log(`  Contrato: ${filtroContrato} · días de servicio ${desde} → ${hasta}`);
    console.log(
      `  Corredor: ${num(corredorKm * 1000, 0)} m · umbral A: ${umbral} % · umbral B: ${umbralCorredor} %` +
        (umbralArg !== null && umbralArg !== umbralConfigurado
          ? `  ⚠ B FORZADO (lo configurado es ${umbralConfigurado} %)`
          : ""),
    );
    console.log(`  ${candidatas.length} pares (ocurrencia × aparato) · solo lectura\n`);

    /** Las tres métricas de una candidata sobre un conjunto de puntos dado. */
    const medir = (puntos: GpsPoint[], wps: Waypoint[]) => ({
      ponderada: computeWeightedRouteMatchPct(puntos, wps, idf, corredorKm),
      llana: computeRouteMatchPct(puntos, wps, corredorKm),
      corredor: computeCorridorPrecisionPct(puntos, wps, corredorKm),
    });

    // Con todos los puntos guardados.
    const base = candidatas.map((c) => ({
      c,
      pts: c.puntos.length,
      m: medir(c.puntos, waypointsPorOcurrencia.get(c.ocurrencia)!),
    }));

    /*
     * El grupo de control, y es la regla 9: una causa NO se acredita contra las
     * que fallan sino **contra las que pasan**. La mayoría de estos pares es
     * flota corriendo otras rutas —una candidata cualquiera cubre 0 % de una
     * ruta que no sirvió—, así que una mediana sobre todas no dice nada del
     * fenómeno: dice que la flota es grande. Las que acreditan HOY son la
     * población que importa, porque son las únicas a las que adelgazar les
     * puede quitar algo.
     */
    // Cada métrica tiene su umbral: A por `kmlMatchMinPct`, B por
    // `kmlCorridorMinPct`. Compararlas contra el mismo número sería el error de
    // los umbrales parecidos otra vez.
    const METRICAS = [
      { nombre: "A ponderada (decide hoy)", leer: (m: Metricas) => m.ponderada, umbral },
      { nombre: "A llana (C17)", leer: (m: Metricas) => m.llana, umbral },
      { nombre: "B corredor", leer: (m: Metricas) => m.corredor, umbralB: true },
      /*
       * La compuerta de verdad, y va última porque es la que manda: acreditar
       * exige A **y** B. Medir cada una por su lado dice cuál es frágil; medir
       * la conjunción dice qué pasa en producción.
       *
       * ⚠ Es A∧B PARCIAL: le faltan los otros dos términos de `servedRoute`
       * —`arrivalAt` y `observableEnough`—, que necesitan el polígono de la
       * geocerca y el tramo observable. Va dicho porque una conjunción a la que
       * le faltan términos **sobreestima** cuántas acreditan, y llamarla «A∧B» a
       * secas sería el rótulo mintiendo otra vez.
       */
      { nombre: "A∧B parcial (la compuerta)", leer: null, conjuncion: true },
    ] as const;

    const adelgazadas = new Map<number, Map<string, Metricas>>();
    for (const seg of PELDANOS) {
      const mapa = new Map<string, Metricas>();
      for (const c of candidatas) {
        mapa.set(
          `${c.ocurrencia}·${c.imei}`,
          medir(adelgazar(c.puntos, seg), waypointsPorOcurrencia.get(c.ocurrencia)!),
        );
      }
      adelgazadas.set(seg, mapa);
    }

    for (const met of METRICAS) {
      const conjuncion = "conjuncion" in met;
      const u = "umbralB" in met ? umbralCorredor : umbral;
      /** Pasa el corte: una métrica sola contra su umbral, o las dos a la vez. */
      const pasa = (m: Metricas) =>
        conjuncion
          ? m.ponderada >= umbral && m.corredor >= umbralCorredor
          : met.leer!(m) >= u;
      const acreditanHoy = base.filter((b) => pasa(b.m));
      const rotulo = conjuncion
        ? `A ≥ ${umbral} % y B ≥ ${umbralCorredor} %`
        : `umbral ${u} %`;
      console.log(`  ── ${met.nombre} · ${rotulo} ${"─".repeat(Math.max(0, 30 - met.nombre.length))}`);
      console.log(
        `  ${"peldaño".padEnd(22)}${"acreditan".padStart(11)}${"pierde".padStart(9)}` +
          `${"conserva".padStart(11)}${"mediana de las que acreditan hoy".padStart(36)}`,
      );
      const medBase = conjuncion ? null : mediana(acreditanHoy.map((b) => met.leer!(b.m)));
      console.log(
        `  ${"tal como está".padEnd(22)}${`${acreditanHoy.length}`.padStart(11)}` +
          `${"—".padStart(9)}${"100 %".padStart(11)}` +
          `${(medBase === null ? "—" : num(medBase) + " %").padStart(36)}`,
      );
      for (const seg of PELDANOS) {
        const mapa = adelgazadas.get(seg)!;
        const pasan = candidatas.filter((c) => pasa(mapa.get(`${c.ocurrencia}·${c.imei}`)!)).length;
        const sobreviven = acreditanHoy.filter((b) => pasa(mapa.get(`${b.c.ocurrencia}·${b.c.imei}`)!));
        const conserva =
          acreditanHoy.length > 0 ? (sobreviven.length / acreditanHoy.length) * 100 : 100;
        const med = conjuncion ? null : mediana(acreditanHoy.map((b) => met.leer!(mapa.get(`${b.c.ocurrencia}·${b.c.imei}`)!)));
        console.log(
          `  ${`1 punto / ${seg} s`.padEnd(22)}${`${pasan}`.padStart(11)}` +
            `${`−${acreditanHoy.length - sobreviven.length}`.padStart(9)}` +
            `${(num(conserva, 0) + " %").padStart(11)}` +
            `${(med === null ? "—" : num(med) + " %").padStart(36)}`,
        );
      }
      console.log("");
    }

    console.log(
      `  Todo lo demás quedó fijo: la misma unidad, el mismo trazado, el mismo día,\n` +
        `  la misma geometría. Lo único que cambió es cuántos puntos hay.\n` +
        `  «acreditan» son las candidatas que alcanzan el umbral de esa métrica sobre\n` +
        `  ${base.length} pares (ocurrencia × aparato); la mayoría es flota corriendo otras rutas.\n` +
        `  «conserva» es la comparación PAREADA: de las que acreditan hoy con esa métrica,\n` +
        `  qué fracción sigue acreditando al adelgazar. **Es la robustez de la métrica\n` +
        `  frente a la densidad**, que es lo que decide si el arreglo necesita métrica nueva.\n` +
        `  NO dice cuántos servicios cambiarían de veredicto: eso exige simulación (D4).\n`,
    );
  }
}

// Sólo corre como guion; importado desde una prueba, no se conecta a nada.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "")) {
  main().then(
    () => process.exit(0),
    (e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    },
  );
}
