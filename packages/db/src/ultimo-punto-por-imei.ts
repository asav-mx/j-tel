import { sql, type SQL } from "drizzle-orm";

/**
 * El último `recorded_at` archivado de cada IMEI, una fila por IMEI que tenga
 * historia (los que no tienen, no salen).
 *
 * **La forma es el arreglo, no un detalle.** La versión anterior era
 * `SELECT imei, max(recorded_at) … WHERE imei IN (…) GROUP BY imei`. Se lee
 * igual de bien y el planificador no la resuelve con el índice único
 * `(imei, recorded_at)`: con los IMEIs de Compás leía `telemetry_points`
 * completa (4.3 M filas) y tardaba **2.3 s** en producción, en cada carga de
 * Flota en vivo.
 *
 * Aquí cada IMEI hace su propia búsqueda `ORDER BY recorded_at DESC LIMIT 1`
 * dentro de un `LATERAL`. Eso sólo tiene una forma de resolverse: bajar el
 * índice desde el final de ese IMEI y tomar la primera entrada. El costo pasa
 * a ser proporcional al número de IMEIs, no al tamaño de la tabla, y no crece
 * con los ~51 000 puntos diarios.
 *
 * Vive aparte del repositorio para que `medir-ultimo-punto-por-imei` mida
 * exactamente esta consulta y no una copia que se pueda desalinear.
 */
export function consultaUltimoPuntoPorImei(imeis: string[]): SQL {
  const lista = sql.join(
    imeis.map((imei) => sql`${imei}`),
    sql`, `,
  );
  return sql`
    SELECT i.imei, u.recorded_at AS ultimo
      FROM unnest(ARRAY[${lista}]::text[]) AS i(imei)
      CROSS JOIN LATERAL (
        SELECT tp.recorded_at
          FROM telemetry_points tp
         WHERE tp.imei = i.imei
         ORDER BY tp.recorded_at DESC
         LIMIT 1
      ) u
  `;
}
