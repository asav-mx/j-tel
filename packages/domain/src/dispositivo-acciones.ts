/**
 * Las acciones sobre un dispositivo — C4 del cuarto de Compás.
 *
 * Marco 6.18: «lo que se puede crear se puede corregir desde la pantalla».
 * Aquí viven las reglas sin base ni pantalla: cómo se llama un dispositivo
 * nuevo, qué cuenta como motivo, y cuándo una acción procede. La escritura
 * vive en `FleetRepository`; quién puede pedirla, en la ruta.
 *
 * Decisiones de Asav, 16 de septiembre de 2026:
 *
 *   · el carrier captura el IMEI y **el sistema genera el nombre** (6.3);
 *   · asignar y soltar son **sólo «ahora»**: poner otra hora reescribe a qué
 *     unidad pertenece evidencia ya archivada, y merece su propia conversación;
 *   · se guarda **quién y por qué** en cada asignación que se cierra y en cada
 *     baja;
 *   · el IMEI único en toda la plataforma queda para después.
 */

/**
 * Los modelos que la plataforma sabe nombrar: marca + modelo, sin el
 * consecutivo (6.3). Hoy uno solo, el Teltonika FTC927 de Compás.
 *
 * El prefijo va dentro del nombre y no en una columna: el nombre se genera una
 * vez y nunca se renumera, así que lo que diga el prefijo el día del alta es lo
 * que queda. Un modelo nuevo es un renglón más aquí.
 */
export const MODELOS_DE_DISPOSITIVO = [
  { prefijo: "TK-FTC927", marca: "Teltonika", modelo: "FTC927" },
] as const;

export type PrefijoDeModelo = (typeof MODELOS_DE_DISPOSITIVO)[number]["prefijo"];

export function esPrefijoDeModelo(valor: string): valor is PrefijoDeModelo {
  return MODELOS_DE_DISPOSITIVO.some((m) => m.prefijo === valor);
}

/**
 * El nombre de un dispositivo: `TK-FTC927-009`.
 *
 * El consecutivo es de toda la plataforma (6.3) y lo entrega la base; aquí
 * sólo se escribe. Tres cifras como mínimo, sin tope: el 1000 se escribe
 * `1000`, no se trunca a `100` — un nombre truncado sería el de otro.
 */
export function nombreDeDispositivo(prefijo: PrefijoDeModelo, consecutivo: number): string {
  if (!Number.isInteger(consecutivo) || consecutivo < 1) {
    throw new Error(`Consecutivo inválido: ${consecutivo}`);
  }
  return `${prefijo}-${String(consecutivo).padStart(3, "0")}`;
}

/** Lo más largo que se guarda como motivo. Una explicación, no un informe. */
export const MOTIVO_MAX = 280;

/**
 * El motivo que escribe quien suelta o da de baja, ya limpio, o por qué no
 * sirve. Un motivo vacío no es motivo (la 0036 lo exige para la baja; C4 lo
 * pide también al soltar).
 */
export function motivoCapturado(
  texto: string | null | undefined,
): { ok: true; motivo: string } | { ok: false; error: "motivo_vacio" | "motivo_largo" } {
  const limpio = (texto ?? "").replace(/\s+/g, " ").trim();
  if (limpio.length === 0) return { ok: false, error: "motivo_vacio" };
  if (limpio.length > MOTIVO_MAX) return { ok: false, error: "motivo_largo" };
  return { ok: true, motivo: limpio };
}

/**
 * Los motivos que escribe el sistema cuando una acción cierra, de paso, otra
 * asignación. Quien asigna el 003 a la 10254 no escribió «soltar el 005»,
 * pero eso fue lo que pasó con el 005, y su historia lo tiene que decir.
 */
export const MOTIVO_SISTEMA = {
  /** El dispositivo pasó a otra unidad. */
  dispositivoReasignado: (unidadNueva: string) => `Se asignó a la unidad ${unidadNueva}`,
  /** La unidad recibió otro dispositivo. */
  unidadRecibioOtro: (dispositivoNuevo: string) => `La unidad recibió el dispositivo ${dispositivoNuevo}`,
  /** El dispositivo se dio de baja montado. */
  baja: (motivo: string) => `Baja del dispositivo: ${motivo}`,
} as const;

// ── Cuándo procede cada acción ────────────────────────────────────────────

export interface DispositivoParaAccion {
  retiredAt: Date | null;
  /** La unidad donde está montado ahora, o null si está en bodega. */
  unidadVigenteId: string | null;
}

export interface UnidadParaAccion {
  id: string;
  active: boolean;
}

export type ErrorDeAccion =
  | "dispositivo_de_baja"
  | "unidad_inactiva"
  | "ya_asignado_ahi"
  | "no_esta_montado"
  | "ya_de_baja";

export type Procede = { ok: true } | { ok: false; error: ErrorDeAccion };

/**
 * Asignar: un dispositivo de baja no se ofrece (6.5) y una unidad inactiva no
 * recibe dispositivo. Asignarlo donde ya está no es un error del mundo, pero
 * tampoco es una acción: no se cierra y se reabre la misma asignación, porque
 * eso partiría su historia en dos sin que nada cambiara.
 */
export function procedeAsignar(dispositivo: DispositivoParaAccion, unidad: UnidadParaAccion): Procede {
  if (dispositivo.retiredAt) return { ok: false, error: "dispositivo_de_baja" };
  if (!unidad.active) return { ok: false, error: "unidad_inactiva" };
  if (dispositivo.unidadVigenteId === unidad.id) return { ok: false, error: "ya_asignado_ahi" };
  return { ok: true };
}

/** Soltar: sólo lo que está montado. Uno en bodega ya está suelto. */
export function procedeSoltar(dispositivo: DispositivoParaAccion): Procede {
  if (!dispositivo.unidadVigenteId) return { ok: false, error: "no_esta_montado" };
  return { ok: true };
}

/**
 * Dar de baja: una sola vez. Montado o no — si está montado, la baja lo suelta
 * en la misma transacción, porque «de baja y montado» es justo la anomalía que
 * la flota ya acusa (`unirDispositivosConUnidades`).
 */
export function procedeBaja(dispositivo: DispositivoParaAccion): Procede {
  if (dispositivo.retiredAt) return { ok: false, error: "ya_de_baja" };
  return { ok: true };
}

/** Cada error en palabras de quien captura, sin jerga. */
export const PALABRAS_DE_ERROR: Record<ErrorDeAccion | "motivo_vacio" | "motivo_largo", string> = {
  dispositivo_de_baja: "Este dispositivo está de baja: no se puede asignar.",
  unidad_inactiva: "Esa unidad está inactiva: no recibe dispositivo.",
  ya_asignado_ahi: "El dispositivo ya está en esa unidad.",
  no_esta_montado: "El dispositivo no está en ninguna unidad: no hay nada que soltar.",
  ya_de_baja: "Este dispositivo ya estaba de baja.",
  motivo_vacio: "Escribe el motivo.",
  motivo_largo: `El motivo no cabe: usa menos de ${MOTIVO_MAX} letras.`,
};
