/**
 * El expediente: la vista completa de un id (Marco, Pieza 6 §H, 6.30–6.33).
 *
 * Todo aquí es **puro**: recibe filas y un día, devuelve estados. No lee la base
 * ni sabe de pantallas. Gobierna `docs/Ficha-Expedientes.md`, ratificada por
 * ASAV el 16 de septiembre de 2026.
 *
 * Dos cosas viven aquí:
 *
 * 1. **Los tres estados de una parte** (ficha §3). Cada parte de una familia
 *    está con datos, vacía, o aún no disponible. Ninguna se esconde. Lo que no
 *    aplica no es ninguno de los tres: simplemente no está.
 *
 * 2. **La vigencia de un papel** (ficha §4 y §5). La regla de cada tipo es
 *    configuración de su mercado, y puede faltar entera o en parte. Cuando falta
 *    lo que una decisión necesita, el estado es «falta la regla»: no se supone
 *    obligatorio, ni que vence, ni ningún número de días de aviso.
 */

// ── Los tres estados de una parte ────────────────────────────────────────

/**
 * De dónde va a llegar una parte que hoy nada alimenta.
 *
 * Es un código, no una frase: la frase la pone la pantalla. Cada valor nombra
 * algo que existe en el plan con nombre — si una parte no tiene de dónde llegar,
 * no es «aún no disponible», es otra cosa.
 */
export type FuentePendiente =
  /** Recorridos y playback: llegan con Flota en vivo. */
  | "flota_en_vivo"
  /** Qué choferes lleva una unidad, y qué unidades operó un chofer. */
  | "asignacion_de_choferes"
  /** La cuenta no tiene mercado todavía, así que no hay catálogo que aplicarle. */
  | "mercado_de_la_cuenta";

export type Parte<T> =
  /** Hay una fuente que se alimenta, y trae registros. */
  | { estado: "con_datos"; valor: T }
  /** Hay una fuente que se alimenta, pero no trae registros. */
  | { estado: "vacia" }
  /**
   * Aplica, pero nada la alimenta todavía. **Nunca** para algo que la base ya
   * tiene: decirlo de un dato guardado es una afirmación falsa (Marco 6.19).
   */
  | { estado: "aun_no_disponible"; fuente: FuentePendiente };

/** Con datos si hay algo; vacía si la lista o el valor no traen nada. */
export function parteDe<T>(valor: T | null | undefined): Parte<T> {
  if (valor === null || valor === undefined) return { estado: "vacia" };
  if (Array.isArray(valor) && valor.length === 0) return { estado: "vacia" };
  if (typeof valor === "string" && valor.trim() === "") return { estado: "vacia" };
  return { estado: "con_datos", valor };
}

export function aunNoDisponible<T>(fuente: FuentePendiente): Parte<T> {
  return { estado: "aun_no_disponible", fuente };
}

// ── La regla de un tipo de papel ─────────────────────────────────────────

/**
 * La regla vigente de un tipo, tal como la cargó su mercado.
 *
 * Cada campo `null` es «todavía no se carga». Un tipo sin ninguna versión de
 * regla se pasa como `null` entero.
 */
export interface ReglaDeTipo {
  obligatorio: boolean | null;
  vence: boolean | null;
  diasDeAviso: number | null;
  periodicidadMeses: number | null;
}

/** La versión vigente de una foja: lo que dice el papel. Fechas civiles YYYY-MM-DD. */
export interface VersionDeFoja {
  folio: string | null;
  emitidoEl: string | null;
  venceEl: string | null;
  venceCalculado: boolean;
}

/** Qué pieza de la regla falta para poder decidir. */
export type PiezaDeRegla = "obligatorio" | "vence" | "dias_de_aviso";

export type EstadoDePapel =
  | { estado: "vencido"; venceEl: string; diasVencido: number }
  | { estado: "por_vencer"; venceEl: string; diasRestantes: number }
  | { estado: "vigente"; venceEl: string; diasRestantes: number }
  | { estado: "sin_vencimiento" }
  /** Es obligatorio y no hay ninguna foja. */
  | { estado: "falta" }
  /** No es obligatorio y no hay ninguna foja. No pide nada. */
  | { estado: "no_capturado" }
  /** El tipo vence, pero la foja no trae fecha y no se pudo calcular. */
  | { estado: "falta_la_fecha" }
  /**
   * La regla no alcanza para decidir. Si el papel trae fecha, se dan sus días:
   * mostrar «en 12 d» no supone ninguna regla; llamarlo vigente o por vencer, sí.
   */
  | {
      estado: "falta_la_regla";
      falta: PiezaDeRegla;
      venceEl: string | null;
      diasRestantes: number | null;
    };

export type NombreDeEstadoDePapel = EstadoDePapel["estado"];

/** Días civiles de `desde` a `hasta` (YYYY-MM-DD). Negativo si `hasta` es antes. */
export function diasCiviles(desde: string, hasta: string): number {
  const a = Date.UTC(+desde.slice(0, 4), +desde.slice(5, 7) - 1, +desde.slice(8, 10));
  const b = Date.UTC(+hasta.slice(0, 4), +hasta.slice(5, 7) - 1, +hasta.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/**
 * El estado de un tipo de papel para un sujeto, hoy.
 *
 * `hoy` es la fecha civil **en la zona del mercado** (ficha §4): un papel que
 * vence el 30 es vigente todo el 30 y está vencido desde el 1 a las 00:00.
 *
 * El orden de las preguntas importa, y cada una se explica:
 *
 * 1. **Sin foja**, decide sólo «obligatorio».
 * 2. **Una fecha que ya pasó es vencido**, diga lo que diga la regla. Es lo que
 *    dice el papel impreso; ninguna configuración lo desmiente, y callarlo
 *    porque la regla no está cargada sería esconder un vencimiento.
 * 3. **«No vence»** gana sobre cualquier fecha futura capturada.
 * 4. Si no se sabe si vence, **falta la regla**.
 * 5. Si vence y no hay fecha, **falta la fecha**: es un hueco de captura, no de
 *    configuración.
 * 6. Si vence y hay fecha pero no días de aviso, **falta la regla**: sin ellos,
 *    vigente y por vencer son las dos suposiciones.
 */
export function estadoDePapel(entrada: {
  regla: ReglaDeTipo | null;
  foja: VersionDeFoja | null;
  hoy: string;
}): EstadoDePapel {
  const { regla, foja, hoy } = entrada;

  if (!foja) {
    if (regla?.obligatorio === true) return { estado: "falta" };
    if (regla?.obligatorio === false) return { estado: "no_capturado" };
    return { estado: "falta_la_regla", falta: "obligatorio", venceEl: null, diasRestantes: null };
  }

  const venceEl = foja.venceEl;
  const dias = venceEl ? diasCiviles(hoy, venceEl) : null;

  if (venceEl && dias !== null && dias < 0) {
    return { estado: "vencido", venceEl, diasVencido: -dias };
  }
  if (regla?.vence === false) return { estado: "sin_vencimiento" };
  if (regla?.vence == null) {
    return { estado: "falta_la_regla", falta: "vence", venceEl, diasRestantes: dias };
  }
  if (!venceEl || dias === null) return { estado: "falta_la_fecha" };
  if (regla.diasDeAviso == null) {
    return { estado: "falta_la_regla", falta: "dias_de_aviso", venceEl, diasRestantes: dias };
  }
  return dias <= regla.diasDeAviso
    ? { estado: "por_vencer", venceEl, diasRestantes: dias }
    : { estado: "vigente", venceEl, diasRestantes: dias };
}

/**
 * Lo que le pide algo **al transportista**.
 *
 * «Falta la regla» no está: es trabajo de quien configura el mercado, no del
 * carrier. Pero tampoco está al día — ver `estaAlDia`.
 */
export const ESTADOS_QUE_PIDEN_ALGO: readonly NombreDeEstadoDePapel[] = [
  "vencido",
  "falta",
  "falta_la_fecha",
  "por_vencer",
];

/**
 * Del peor al mejor, para el glifo de una pieza que resume varios papeles.
 *
 * «Falta la regla» va antes que vigente: una unidad con un papel sin regla no se
 * puede presentar al día, porque eso supondría la regla que falta.
 */
export const ORDEN_DE_ESTADOS: readonly NombreDeEstadoDePapel[] = [
  "vencido",
  "falta",
  "falta_la_fecha",
  "por_vencer",
  "falta_la_regla",
  "vigente",
  "sin_vencimiento",
  "no_capturado",
];

export function peorEstado(estados: readonly EstadoDePapel[]): NombreDeEstadoDePapel | null {
  let peor: number | null = null;
  for (const e of estados) {
    const i = ORDEN_DE_ESTADOS.indexOf(e.estado);
    if (peor === null || i < peor) peor = i;
  }
  return peor === null ? null : ORDEN_DE_ESTADOS[peor]!;
}

export interface ResumenDePapeles {
  /** Cuántos papeles le piden algo al transportista. */
  pidenAlgo: number;
  /** Cuántos no se pueden juzgar porque falta la regla del mercado. */
  faltaLaRegla: number;
  /** El peor estado, para el glifo. `null` si no hay ningún tipo en el catálogo. */
  peor: NombreDeEstadoDePapel | null;
  /** Al día sólo si nada pide algo **y** nada depende de una regla que falta. */
  estaAlDia: boolean;
}

export function resumirPapeles(estados: readonly EstadoDePapel[]): ResumenDePapeles {
  const pidenAlgo = estados.filter((e) => ESTADOS_QUE_PIDEN_ALGO.includes(e.estado)).length;
  const faltaLaRegla = estados.filter((e) => e.estado === "falta_la_regla").length;
  return {
    pidenAlgo,
    faltaLaRegla,
    peor: peorEstado(estados),
    estaAlDia: estados.length > 0 && pidenAlgo === 0 && faltaLaRegla === 0,
  };
}

// ── El vencimiento calculado ─────────────────────────────────────────────

/**
 * La fecha de vencimiento desde la emisión y la periodicidad, cuando el papel no
 * la trae impresa (ficha §4). Se guarda marcada como calculada.
 *
 * Un mes se suma en el calendario, no en días. Si el día no existe en el mes de
 * llegada, se queda en el último día de ese mes: un papel emitido el 31 de
 * agosto con periodicidad de 6 meses vence el 28 de febrero (o el 29), no el 3
 * de marzo — correrse de mes sería conceder días que ninguna ley dio.
 */
export function vencimientoCalculado(emitidoEl: string, periodicidadMeses: number): string {
  const anio = +emitidoEl.slice(0, 4);
  const mes = +emitidoEl.slice(5, 7) - 1;
  const dia = +emitidoEl.slice(8, 10);
  const totalMeses = mes + periodicidadMeses;
  const anioFinal = anio + Math.floor(totalMeses / 12);
  const mesFinal = ((totalMeses % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anioFinal, mesFinal + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(anioFinal, mesFinal, Math.min(dia, ultimoDia)));
  return d.toISOString().slice(0, 10);
}

/**
 * Qué fecha de vencimiento se guarda al capturar o corregir.
 *
 * La impresa gana siempre. Si no hay impresa, se calcula sólo cuando la regla
 * dice que vence y trae periodicidad, y hay emisión. En cualquier otro caso no
 * hay fecha — y la lectura dirá «falta la fecha» si el tipo vence.
 */
export function fechaDeVencimientoAGuardar(entrada: {
  venceElImpreso: string | null;
  emitidoEl: string | null;
  regla: ReglaDeTipo | null;
}): { venceEl: string | null; calculado: boolean } {
  const { venceElImpreso, emitidoEl, regla } = entrada;
  if (venceElImpreso) return { venceEl: venceElImpreso, calculado: false };
  if (emitidoEl && regla?.vence === true && regla.periodicidadMeses) {
    return { venceEl: vencimientoCalculado(emitidoEl, regla.periodicidadMeses), calculado: true };
  }
  return { venceEl: null, calculado: false };
}
