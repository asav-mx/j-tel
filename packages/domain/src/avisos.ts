import { instanteZonificado } from "./tiempo.js";

/**
 * Un aviso de la concesión al pasajero (Marco 8.13b; Ontoy 2.0, PR 4a).
 *
 * **Una sola validación**, la misma en la API de J-Staff, en su vista previa y
 * en las pruebas. La base repite los límites en sus CHECK (0052): la base cuida
 * que nada roto entre; esto dice al que captura qué corregir, en palabras.
 *
 * 8.13b pide que un aviso sea **fechado y atribuido** y **nunca un letrero de
 * alarma**. Lo primero lo pone la pantalla («según la concesión» y su fecha);
 * de lo segundo, lo único que se puede cuidar al escribir es el grito: un título
 * todo en mayúsculas se lee como alarma y se rechaza, con la razón.
 */

export const TITULO_MAXIMO = 80;
export const DETALLE_MAXIMO = 280;

export interface AvisoCapturado {
  titulo: string;
  detalle: string | null;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
}

export type AvisoValidado = { ok: true; aviso: AvisoCapturado } | { ok: false; error: string };

export function validarAviso(
  entrada: { titulo: string; detalle?: string | null; desde?: Date | null; hasta?: Date | null },
  ahora: Date,
): AvisoValidado {
  const titulo = entrada.titulo.trim().replace(/\s+/g, " ");
  const detalle = entrada.detalle?.trim() ? entrada.detalle.trim() : null;
  const desde = entrada.desde ?? ahora;
  const hasta = entrada.hasta ?? null;

  if (!titulo) return { ok: false, error: "Falta el título del aviso" };
  if (titulo.length > TITULO_MAXIMO) return { ok: false, error: `El título es de ${TITULO_MAXIMO} caracteres como mucho` };
  if (detalle && detalle.length > DETALLE_MAXIMO) {
    return { ok: false, error: `El detalle es de ${DETALLE_MAXIMO} caracteres como mucho` };
  }
  if (esGrito(titulo)) {
    return { ok: false, error: "Escríbelo en minúsculas normales: todo en mayúsculas se lee como alarma" };
  }
  if (Number.isNaN(desde.getTime()) || (hasta && Number.isNaN(hasta.getTime()))) {
    return { ok: false, error: "Una de las fechas no se entiende" };
  }
  if (hasta && hasta <= desde) return { ok: false, error: "«Hasta» tiene que ser después de «desde»" };
  if (hasta && hasta <= ahora) return { ok: false, error: "«Hasta» ya pasó: el aviso no se vería nunca" };

  return { ok: true, aviso: { titulo, detalle, vigenteDesde: desde, vigenteHasta: hasta } };
}

/** Todo en mayúsculas (con al menos 5 letras): un grito, no un aviso. */
function esGrito(texto: string): boolean {
  const letras = texto.replace(/[^\p{L}]/gu, "");
  return letras.length >= 5 && letras === letras.toLocaleUpperCase("es-MX") && letras !== letras.toLocaleLowerCase("es-MX");
}

/**
 * Si un aviso se enseña al pasajero ahora: no retirado, ya empezó y no ha
 * terminado. La usan la consulta del repositorio (en SQL) y la pantalla de
 * J-Staff (para decir «en Ontoy ahora» / «programado» / «terminó»).
 */
export function situacionDelAviso(
  a: { vigenteDesde: Date; vigenteHasta: Date | null; retiradoEn: Date | null },
  ahora: Date,
): "en_ontoy" | "programado" | "termino" | "retirado" {
  if (a.retiradoEn) return "retirado";
  if (a.vigenteDesde > ahora) return "programado";
  if (a.vigenteHasta && a.vigenteHasta <= ahora) return "termino";
  return "en_ontoy";
}

/**
 * Un campo `datetime-local` del formulario («2026-09-22T14:30»), leído **en la
 * zona del circuito**: el navegador no manda zona, y leerlo en la del servidor
 * movería el aviso horas. Vacío o mal escrito, `null`.
 */
export function instanteDeCampoLocal(valor: string | null | undefined, zona: string): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec((valor ?? "").trim());
  if (!m) return null;
  return instanteZonificado(m[1]!, Number(m[2]) * 60 + Number(m[3]), zona);
}
