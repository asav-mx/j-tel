import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Comparar dos secretos sin filtrar por dónde dejaron de parecerse.
 *
 * Vivía dentro de `identidad-dev.ts`, privada, mientras las siete rutas de
 * cron comparaban su secreto con `!==`. Dos criterios distintos para la misma
 * pregunta en el mismo repo: el que se escribió con cuidado no lo usaba nadie
 * más, y el que se usaba siete veces no tenía ninguno. Sale aquí para que haya
 * uno solo.
 *
 * Se compara el digest y no el texto por dos razones. `timingSafeEqual` exige
 * búferes del mismo tamaño y lanza si no lo son —así que dos largos distintos
 * reventarían antes de comparar, que es en sí mismo una respuesta—, y pasando
 * por SHA-256 el largo del secreto tampoco se filtra.
 */
export function igualEnTiempoConstante(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}
