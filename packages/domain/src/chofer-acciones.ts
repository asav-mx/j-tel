/**
 * El alta y la corrección de un chofer — Choferes V1.
 *
 * Aquí viven las reglas sin base ni pantalla: qué es un nombre, qué es un
 * número de licencia, y cuándo dos choferes de una cuenta chocan. Es la misma
 * forma que `unidad-acciones.ts` (C4-e), y por las mismas razones.
 *
 * Decisiones de Asav, 19 de septiembre de 2026 (ficha de Choferes V1 y sus
 * enmiendas):
 *
 *   · el alta pide lo mínimo que identifica (Plan-Choferes §3): **nombre** y
 *     **número de licencia**, obligatorios; el vencimiento, si la licencia lo
 *     trae — y ése no se guarda aquí sino como papel «Licencia» del catálogo;
 *   · **ningún nombre ni licencia se repiten entre los choferes activos de una
 *     cuenta**, con el candado en la base además del aviso (0042);
 *   · corregir la identidad **sobrescribe**, igual que la unidad.
 */

import { nombreComparable } from "./unidad-acciones.js";
import { esFechaCivil } from "./tiempo.js";

/** Lo más largo que se guarda como nombre de un chofer. */
export const NOMBRE_DE_CHOFER_MAX = 120;
/** Lo más largo que se guarda como número de licencia. */
export const LICENCIA_MAX = 30;

/** Colapsa los espacios de en medio y quita los de los lados. */
const limpio = (texto: string | null | undefined) => (texto ?? "").replace(/\s+/g, " ").trim();

/**
 * La forma de una licencia con la que se compara: sin espacios ni guiones, en
 * mayúsculas. «CHIH-123 45» y «chih12345» son la misma licencia.
 *
 * **Es la misma expresión que el índice único de la 0042**
 * (`upper(regexp_replace(license_number, '[\s-]+', '', 'g'))`). Si una cambia,
 * la otra también: el código diría «libre» y la base diría «repetida».
 */
export function licenciaComparable(licencia: string): string {
  return (licencia ?? "").replace(/[\s-]+/g, "").toUpperCase();
}

/** El nombre de un chofer se compara igual que el de una unidad (0040 y 0042). */
export const nombreDeChoferComparable = nombreComparable;

export type ErrorDeChofer =
  | "nombre_vacio"
  | "nombre_largo"
  | "licencia_vacia"
  | "licencia_larga"
  | "fecha_invalida"
  | "nombre_repetido"
  | "licencia_repetida";

/** Cada error en palabras de quien captura. Los dos de «repetido» se arman con el dato. */
export const PALABRAS_DE_CHOFER: Record<Exclude<ErrorDeChofer, "nombre_repetido" | "licencia_repetida">, string> = {
  nombre_vacio: "Escribe el nombre completo del chofer.",
  nombre_largo: `El nombre no puede pasar de ${NOMBRE_DE_CHOFER_MAX} caracteres.`,
  licencia_vacia: "Escribe el número de licencia.",
  licencia_larga: `El número de licencia no puede pasar de ${LICENCIA_MAX} caracteres.`,
  fecha_invalida: "La fecha de vencimiento no es una fecha válida.",
};

export const palabrasDeChoferRepetido = (nombre: string) => `Ya hay un chofer llamado «${nombre}» en esta cuenta.`;
export const palabrasDeLicenciaRepetida = (licencia: string) => `La licencia ${licencia} ya es de otro chofer de esta cuenta.`;

export type IdentidadDeChofer = { nombre: string; licencia: string };

/**
 * La identidad de un chofer como la capturó alguien, ya limpia, o el primer
 * problema en palabras. El nombre conserva sus mayúsculas —es como lo escribe el
 * transportista—; la licencia se guarda en mayúsculas, como viene impresa.
 */
export function identidadDeChoferCapturada(entrada: {
  nombre: string | null | undefined;
  licencia: string | null | undefined;
}): { ok: true; identidad: IdentidadDeChofer } | { ok: false; error: Exclude<ErrorDeChofer, "nombre_repetido" | "licencia_repetida"> } {
  const nombre = limpio(entrada.nombre);
  if (nombre.length === 0) return { ok: false, error: "nombre_vacio" };
  if (nombre.length > NOMBRE_DE_CHOFER_MAX) return { ok: false, error: "nombre_largo" };
  const licencia = limpio(entrada.licencia).toUpperCase();
  if (licenciaComparable(licencia).length === 0) return { ok: false, error: "licencia_vacia" };
  if (licencia.length > LICENCIA_MAX) return { ok: false, error: "licencia_larga" };
  return { ok: true, identidad: { nombre, licencia } };
}

/**
 * El vencimiento que se tecleó en el alta: vacío es «la licencia no lo trae»
 * (null), no un error. Se guarda como papel «Licencia», nunca en las
 * credenciales (enmienda 2).
 */
export function vencimientoCapturado(texto: string | null | undefined): { ok: true; fecha: string | null } | { ok: false; error: "fecha_invalida" } {
  const v = (texto ?? "").trim();
  if (!v) return { ok: true, fecha: null };
  return esFechaCivil(v) ? { ok: true, fecha: v } : { ok: false, error: "fecha_invalida" };
}

/**
 * ¿Choca esta identidad con otro chofer activo de la cuenta? `mismoId` es el
 * que se está corrigiendo: no choca consigo mismo.
 *
 * Se revisa aquí para decirlo en palabras; la base lo garantiza aunque alguien
 * se salte este código (0042).
 */
export function choqueDeChofer(
  identidad: IdentidadDeChofer,
  otros: Array<{ id: string; nombre: string | null; licencia: string | null }>,
  mismoId: string | null = null,
): { error: "nombre_repetido"; mensaje: string } | { error: "licencia_repetida"; mensaje: string } | null {
  const ajenos = otros.filter((c) => c.id !== mismoId);
  const nombre = nombreComparable(identidad.nombre);
  const conNombre = ajenos.find((c) => c.nombre !== null && nombreComparable(c.nombre) === nombre);
  if (conNombre) return { error: "nombre_repetido", mensaje: palabrasDeChoferRepetido(conNombre.nombre!) };
  const licencia = licenciaComparable(identidad.licencia);
  const conLicencia = ajenos.find((c) => c.licencia !== null && licenciaComparable(c.licencia) === licencia);
  // La licencia como la tiene el otro chofer: «chih10002» tecleado choca con
  // «CHIH-100 02», y es ésa la que se reconoce (revisión visual, 19 sep 2026).
  if (conLicencia) return { error: "licencia_repetida", mensaje: palabrasDeLicenciaRepetida(conLicencia.licencia!) };
  return null;
}

/**
 * Los papeles de chofer que esperan la palabra del abogado (ficha de
 * Expedientes §6 y §7h; enmienda 4 de Choferes V1). Son datos sensibles: no se
 * capturan, y **no cuentan** en el resumen ni en «Piden atención» — un chofer no
 * puede nacer condenado a nunca estar al día por papeles que ni se pueden
 * capturar. Por su clave estable del catálogo (0038).
 */
export const PAPELES_QUE_ESPERAN_AL_ABOGADO: readonly string[] = ["examen_medico", "antidoping"];

/** La clave del papel donde vive el vencimiento de la licencia (catálogo, 0038). */
export const CLAVE_DE_LA_LICENCIA = "licencia";
