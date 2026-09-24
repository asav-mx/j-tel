import { MOTIVO_MAX } from "./dispositivo-acciones.js";

/**
 * Las acciones sobre un lector — Ontoy 3.0 · PR P3.5.
 *
 * Mismas reglas que las de un aparato de Compás (6.5: alta, asignar, soltar,
 * baja con fecha y motivo, **la fila no se borra**) sobre un aparato distinto,
 * decidido así por Asav el 23-sep-2026.
 *
 * ## Por qué un módulo propio y no `dispositivo-acciones.ts`
 *
 * Las reglas se parecen y las palabras no. Un chofer al que le rechazan una
 * acción tiene que leer «este lector», no «este dispositivo»: el camión trae
 * los dos y confundirlos manda a revisar el aparato equivocado. Lo que sí se
 * comparte se importa —el tope del motivo—, para que afinarlo en un lado no
 * deje al otro con el número viejo.
 *
 * El motivo y los motivos que escribe el sistema se reusan tal cual de
 * `dispositivo-acciones.ts`: ahí no hay nada de GPS, es la forma de escribir
 * por qué se cerró algo.
 */

/**
 * El prefijo del nombre de un lector.
 *
 * Los aparatos de Compás llevan marca y modelo (`TK-FTC927`, Marco 6.3) porque
 * se compran por modelo. El lector del laboratorio es **un teléfono cualquiera**
 * y no hay modelo que declarar; cuando exista el aparato industrial, su
 * prefijo es un renglón más, como `MODELOS_DE_DISPOSITIVO`.
 */
export const PREFIJO_DE_LECTOR = "LEC";

/**
 * El nombre de un lector: `LEC-009`.
 *
 * El consecutivo es de toda la plataforma y lo entrega la base
 * (`validators_consecutivo_seq`): se asigna una vez y no se renumera. Tres
 * cifras como mínimo y sin tope — un nombre truncado sería el de otro.
 */
export function nombreDeLector(consecutivo: number): string {
  if (!Number.isInteger(consecutivo) || consecutivo < 1) {
    throw new Error(`Consecutivo inválido: ${consecutivo}`);
  }
  return `${PREFIJO_DE_LECTOR}-${String(consecutivo).padStart(3, "0")}`;
}

/** Una llave pública Ed25519 en hex, que es lo único que identifica al aparato. */
export function llavePublicaBienFormada(hex: string): boolean {
  return typeof hex === "string" && /^[0-9a-f]{64}$/.test(hex);
}

export interface LectorParaAccion {
  readonly bajaEn: Date | null;
  /** La unidad donde está montado ahora, o null si está en bodega. */
  readonly unidadVigenteId: string | null;
}

export interface UnidadParaLector {
  readonly id: string;
  readonly active: boolean;
}

export type ErrorDeAccionDeLector =
  | "lector_de_baja"
  | "unidad_inactiva"
  | "ya_asignado_ahi"
  | "no_esta_montado"
  | "ya_de_baja";

export type ProcedeConLector = { ok: true } | { ok: false; error: ErrorDeAccionDeLector };

/**
 * Asignar: un lector de baja no se ofrece (6.5) y una unidad inactiva no recibe
 * lector. Asignarlo donde ya está no parte su historia en dos por nada.
 */
export function procedeAsignarLector(
  lector: LectorParaAccion,
  unidad: UnidadParaLector,
): ProcedeConLector {
  if (lector.bajaEn) return { ok: false, error: "lector_de_baja" };
  if (!unidad.active) return { ok: false, error: "unidad_inactiva" };
  if (lector.unidadVigenteId === unidad.id) return { ok: false, error: "ya_asignado_ahi" };
  return { ok: true };
}

/** Soltar: sólo lo que está montado. Uno en bodega ya está suelto. */
export function procedeSoltarLector(lector: LectorParaAccion): ProcedeConLector {
  if (!lector.unidadVigenteId) return { ok: false, error: "no_esta_montado" };
  return { ok: true };
}

/**
 * Dar de baja: una sola vez, montado o no.
 *
 * **La baja de un lector revoca su llave**, y eso es lo que la separa de la
 * baja de un GPS: un aparato robado deja de poder escribir en el libro en el
 * instante en que alguien lo da de baja. Por eso no hay «baja programada para
 * mañana» — una revocación con fecha futura es una llave viva.
 */
export function procedeBajaDeLector(lector: LectorParaAccion): ProcedeConLector {
  if (lector.bajaEn) return { ok: false, error: "ya_de_baja" };
  return { ok: true };
}

/** Cada error en palabras de quien captura, sin jerga. */
export const PALABRAS_DE_ERROR_DE_LECTOR: Record<
  ErrorDeAccionDeLector | "motivo_vacio" | "motivo_largo" | "llave_mal_formada",
  string
> = {
  lector_de_baja: "Este lector está de baja: no se puede asignar.",
  unidad_inactiva: "Esa unidad está inactiva: no recibe lector.",
  ya_asignado_ahi: "El lector ya está en esa unidad.",
  no_esta_montado: "El lector no está en ninguna unidad: no hay nada que soltar.",
  ya_de_baja: "Este lector ya estaba de baja.",
  motivo_vacio: "Escribe el motivo.",
  motivo_largo: `El motivo no cabe: usa menos de ${MOTIVO_MAX} letras.`,
  llave_mal_formada: "Esa no es la llave del lector: son 64 caracteres hexadecimales.",
};
