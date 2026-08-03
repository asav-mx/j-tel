import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/**
 * Cuántos parámetros aguanta UNA sentencia de Postgres.
 *
 * El contador del protocolo es un entero de 16 bits, así que el techo no es
 * una recomendación: pasado ese número la base rechaza la sentencia ENTERA.
 * Un `INSERT` de N filas × C columnas gasta N×C parámetros, de modo que el
 * límite se cruza por número de filas mucho antes de lo que nadie espera.
 *
 * Medido contra Postgres (Neon) el 2026-08-03, con 8 columnas por fila:
 *
 *     8 191 filas ×  8 col =  65 528 params → OK
 *     8 192 filas ×  8 col =  65 536 params → MAX_PARAMETERS_EXCEEDED
 *
 * POR QUÉ ESTO EXISTE. `evidence.savePoints` metía ~12 000 puntos en una sola
 * sentencia. La base la rechazaba, el `catch` de `processPending` se tragaba
 * el error, y ocho servicios de un cliente vivo pasaron **35 días sin
 * veredicto** teniendo su evidencia completa esperando en memoria propia. El
 * fallo no fue ruidoso: fue mudo, que es peor. Ver `docs/` y el PR que trae
 * este archivo.
 */
export const MAX_PARAMETROS_POR_SENTENCIA = 65_534;

/**
 * Cuántas filas de `tabla` caben en una sentencia.
 *
 * Se cuenta sobre las columnas DECLARADAS y no sobre las que trae el objeto a
 * insertar, a propósito: contar de más encoge el lote (seguro), contar de
 * menos lo agranda (es el fallo que estamos arreglando). Y al derivarlo del
 * esquema, el día que alguien agregue una columna el lote se ajusta solo en
 * vez de romperse en silencio otra vez.
 */
export function filasPorSentencia(tabla: PgTable): number {
  const columnas = Object.keys(getTableColumns(tabla)).length;
  return Math.max(1, Math.floor(MAX_PARAMETROS_POR_SENTENCIA / Math.max(1, columnas)));
}

/** Parte `filas` en tandas de a lo más `tamano`. Una tanda vacía nunca sale. */
export function enLotes<T>(filas: readonly T[], tamano: number): T[][] {
  const paso = Math.max(1, Math.floor(tamano));
  const lotes: T[][] = [];
  for (let i = 0; i < filas.length; i += paso) {
    lotes.push(filas.slice(i, i + paso));
  }
  return lotes;
}

/**
 * Corre `escribir` una vez por tanda y concatena lo que devuelva.
 *
 * Sin transacción a propósito: estas escrituras son puntos de evidencia y
 * telemetría, donde media escritura vale más que ninguna —los puntos que sí
 * entraron son evidencia real— y el camino que llama vuelve a pasar. Si algún
 * día se usa para algo donde media escritura sea una mentira, hay que envolver
 * la llamada en una transacción, no cambiar esto.
 */
export async function escribirEnLotes<T, R>(
  filas: readonly T[],
  tamano: number,
  escribir: (lote: T[]) => Promise<R[]>,
): Promise<R[]> {
  if (filas.length === 0) return [];
  const salida: R[] = [];
  for (const lote of enLotes(filas, tamano)) {
    salida.push(...(await escribir(lote)));
  }
  return salida;
}
