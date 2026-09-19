import { JTTEL_TZ } from "./tiempo.js";

/**
 * Cómo se lee un hecho sellado — Vernier V1 (`docs/Ficha-Construccion-Vernier-V1.md`).
 *
 * **Todo lo de aquí lee; nada juzga.** El veredicto, el timing, la llegada, la
 * hora límite y la política vienen del hecho tal como se guardó (Marco 1.C: «la
 * verdad se calcula una vez y se guarda»). El motivo de un pendiente o de un no
 * cumplido viene del paso `decision` del ledger, que el motor escribió en la
 * misma corrida que selló el hecho. Leerlo es leer; volver a pasar la evidencia
 * por el motor sería recalcular, y eso no ocurre en ninguna pantalla.
 *
 * Lo que el sello no guardó **no se deduce**: un hecho cuyo ledger no quedó
 * emparejado dice «Motivo no registrado en este sello» (Marco 6.19: nada afirma
 * lo que no comprobó).
 */

export type Veredicto = "cumplido" | "pendiente_evidencia" | "no_cumplido";
export type TimingDelSello = "temprano" | "a_tiempo" | "tarde";

/** Cómo se llama cada veredicto en pantalla. Los tres del Marco, y ninguno más. */
export const NOMBRE_DEL_VEREDICTO: Record<Veredicto, string> = {
  cumplido: "Cumplido",
  pendiente_evidencia: "Pendiente de evidencia",
  no_cumplido: "No cumplido",
};

/**
 * El timing de un cumplido, en palabras. **Se muestra, no se esconde** (Asav,
 * 18 sep 2026): para quien cobra, llegar tarde no es lo mismo que llegar a
 * tiempo aunque el veredicto sea el mismo. No lleva glifo propio: el hexágono
 * es del veredicto.
 */
export const PALABRA_DEL_TIMING: Record<TimingDelSello, string> = {
  temprano: "temprano",
  a_tiempo: "a tiempo",
  tarde: "tarde",
};

/** Los excusables que la política define (Pieza 3), en palabras. */
export const PALABRA_DEL_EXCUSABLE: Record<string, string> = {
  lluvia_nieve: "Lluvia o nieve",
  marchas: "Marchas o bloqueo",
  obstruccion: "Obstrucción en la vía",
  falla_mecanica: "Falla mecánica",
  ponchadura: "Ponchadura",
  obra_sin_aviso: "Obra sin aviso",
};

/**
 * Lo que el ledger del sello vigente aporta, ya extraído.
 *
 * `emparejado: false` cuando no se pudo saber cuál entrada del ledger produjo
 * el hecho vigente (ninguna, ambigua o fuera de tolerancia — ver
 * `pairLedgerEntryWithFact`). Ante la duda no se empareja, y sin entrada no hay
 * motivo que leer.
 */
export type LecturaDelLedger = {
  emparejado: boolean;
  /** El paso `evidencia: indisponible`: no llegó un solo punto. */
  evidenciaIndisponible: boolean;
  /** El paso `decision`, con sus detalles, si lo hubo. */
  decision: { result: string | null; details: Record<string, unknown> } | null;
  /** El paso `cobertura_evidencia`, si lo hubo. */
  cobertura: { result: string | null; details: Record<string, unknown> } | null;
};

export const SIN_LEDGER: LecturaDelLedger = {
  emparejado: false,
  evidenciaIndisponible: false,
  decision: null,
  cobertura: null,
};

/** Lo que el hecho guarda y el motivo necesita. */
export type HechoParaLeer = {
  veredicto: Veredicto;
  timing: TimingDelSello | null;
  llegada: Date | null;
  /** La hora límite congelada en la ocurrencia: llegada exigida, antes de tolerancia. */
  llegadaExigida: Date;
  /** `contract_policy_snapshot.toleranceMinutes`; `null` si el sello no la trae. */
  toleranciaMin: number | null;
  tardeExcusable: boolean;
  motivoExcusable: string | null;
};

export type ClaveDelMotivo =
  | "llego"
  | "sin_hora_de_llegada"
  | "sin_evidencia"
  | "cobertura_insuficiente"
  | "llegada_sin_atribucion"
  | "observacion_insuficiente"
  | "ninguna_unidad_sirvio"
  | "ninguna_unidad_coincidio_ruta"
  | "no_registrado";

/** Una cifra que decidió, con el umbral contra el que se midió. Momento de la decisión del skill. */
export type CifraConUmbral = { medido: string; umbral: string };

export type MotivoDelSello = {
  clave: ClaveDelMotivo;
  /** Dos o tres palabras, para la pieza de la lista. */
  corto: string;
  /** El motivo en lenguaje de evidencia, para el acta. */
  largo: string;
  /** Las cifras que decidieron, con su umbral. Vacío cuando no lo decidió un número. */
  cifras: CifraConUmbral[];
  /** Una línea más, cuando el sello la trae (la llegada tarde marcada excusable). */
  nota: string | null;
};

const NO_REGISTRADO: MotivoDelSello = {
  clave: "no_registrado",
  corto: "motivo no registrado",
  largo: "Motivo no registrado en este sello.",
  cifras: [],
  nota: null,
};

/* ─── La hora, en la zona de la cuenta ─────────────────────────────────── */

const formatos = new Map<string, Intl.DateTimeFormat>();

function formato(zona: string, segundos: boolean): Intl.DateTimeFormat {
  const llave = `${zona}|${segundos}`;
  let f = formatos.get(llave);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: zona,
      hour: "2-digit",
      minute: "2-digit",
      ...(segundos ? { second: "2-digit" } : {}),
      hourCycle: "h23",
    });
    formatos.set(llave, f);
  }
  return f;
}

/** «07:12:41» en la zona dada. */
export function horaConSegundos(t: Date, zona: string = JTTEL_TZ): string {
  return formato(zona, true).format(t);
}

/** «07:12» en la zona dada. */
export function horaCorta(t: Date, zona: string = JTTEL_TZ): string {
  return formato(zona, false).format(t);
}

/* ─── La ventana de llegada ────────────────────────────────────────────── */

/**
 * La ventana de llegada de una ocurrencia: **llegada exigida → límite con
 * tolerancia**, armada con lo sellado (decisión 11 de Asav, 18 sep 2026).
 *
 * Es la misma ventana contra la que se juzgó la llegada tarde, no una
 * reconstruida desde el turno de hoy: la llegada exigida es la hora límite que
 * la ocurrencia congeló al generarse, y la tolerancia sale de la política
 * congelada dentro del hecho. Si la tolerancia no viene en el sello, `hasta` es
 * `null` y quien dibuja lo declara — no se calcula con la de hoy.
 */
export function ventanaDeLlegada(
  llegadaExigida: Date,
  toleranciaMin: number | null,
  zona: string = JTTEL_TZ,
): { desde: string; hasta: string | null } {
  return {
    desde: horaCorta(llegadaExigida, zona),
    hasta: toleranciaMin === null ? null : horaCorta(new Date(llegadaExigida.getTime() + toleranciaMin * 60_000), zona),
  };
}

/** «06:45–06:50», o «06:45 · tolerancia no registrada» cuando el sello no la trae. */
export function ventanaEnPalabras(v: { desde: string; hasta: string | null }): string {
  return v.hasta === null ? `${v.desde} · tolerancia no registrada` : `${v.desde}–${v.hasta}`;
}

/* ─── El motivo ────────────────────────────────────────────────────────── */

const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Un número tal como lo guardó el sello: sin redondear a mano, sin «~». */
const cifra = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));

function motivoDelCumplido(h: HechoParaLeer, zona: string): MotivoDelSello {
  const nota =
    h.timing === "tarde" && h.tardeExcusable
      ? `El sello marca la llegada tarde como excusable${
          h.motivoExcusable ? `: ${PALABRA_DEL_EXCUSABLE[h.motivoExcusable] ?? h.motivoExcusable}` : ""
        }.`
      : null;

  if (!h.llegada) {
    // El Marco dice que un cumplido siempre tiene unidad observada; la hora de
    // llegada es otra columna. Si el sello no la trae, se dice.
    return {
      clave: "sin_hora_de_llegada",
      corto: "sin hora de llegada",
      largo: "La unidad observada sirvió la ruta. El sello no guarda la hora de llegada.",
      cifras: [],
      nota,
    };
  }

  const llegada = horaConSegundos(h.llegada, zona);
  const tol = h.toleranciaMin;
  const limite = tol === null ? null : new Date(h.llegadaExigida.getTime() + tol * 60_000);
  const desde = tol === null ? null : new Date(h.llegadaExigida.getTime() - tol * 60_000);
  const palabra = h.timing ? ` · ${PALABRA_DEL_TIMING[h.timing]}` : "";

  let largo: string;
  let umbral: string;
  if (h.timing === "tarde") {
    largo = "La unidad observada entró a la geocerca de destino después del límite de llegada.";
    umbral = limite ? `límite ${horaConSegundos(limite, zona)}` : "tolerancia no registrada en el sello";
  } else if (h.timing === "temprano") {
    // El motor llama temprano a lo que llega antes de la llegada exigida menos
    // la tolerancia (`determineTiming`). Ése es el umbral que decidió.
    largo = "La unidad observada entró a la geocerca de destino antes de la ventana de llegada.";
    umbral = desde ? `ventana desde ${horaConSegundos(desde, zona)}` : "tolerancia no registrada en el sello";
  } else {
    largo = "La unidad observada entró a la geocerca de destino dentro de la ventana de llegada.";
    umbral = limite ? `límite ${horaConSegundos(limite, zona)}` : "tolerancia no registrada en el sello";
  }

  return {
    clave: "llego",
    corto: `llegó ${horaCorta(h.llegada, zona)}${palabra}`,
    largo,
    cifras: [{ medido: `Llegada ${llegada}`, umbral }],
    nota,
  };
}

function motivoDelPendiente(l: LecturaDelLedger): MotivoDelSello {
  if (!l.emparejado) return NO_REGISTRADO;

  // El orden es el del motor: sin un punto, no hay nada más que contar.
  if (l.evidenciaIndisponible) {
    return {
      clave: "sin_evidencia",
      corto: "sin datos en la ventana",
      largo:
        "No llegó un solo punto de GPS en la ventana de evidencia. Un hueco de datos nunca se juzga como incumplimiento.",
      cifras: [],
      nota: null,
    };
  }

  const razon = l.decision?.details.reason;
  if (razon === "llegada_sin_atribucion") {
    return {
      clave: "llegada_sin_atribucion",
      corto: "llegada sin atribuir",
      largo:
        "Una unidad entró a la geocerca de destino, pero su recorrido no alcanza el mínimo de ninguna ruta: no se puede atribuir a ésta.",
      cifras: [],
      nota: null,
    };
  }
  if (razon === "observacion_insuficiente") {
    const vista = numero(l.decision?.details.earliestObservedFraction);
    const tolerancia = numero(l.decision?.details.originToleranceFraction);
    return {
      clave: "observacion_insuficiente",
      corto: "arranque no observado",
      largo:
        "La evidencia más temprana ya cae dentro del recorrido: el arranque de la ruta no se alcanzó a observar.",
      cifras:
        vista !== null && tolerancia !== null
          ? [{ medido: `Primer punto al ${cifra(vista * 100)} % del trazado`, umbral: `tolerancia ${cifra(tolerancia * 100)} %` }]
          : [],
      nota: null,
    };
  }

  if (l.cobertura?.result === "insuficiente") {
    const d = l.cobertura.details;
    const pct = numero(d.coveragePct);
    const minPct = numero(d.minCoveragePct);
    const hueco = numero(d.maxGapMinutes);
    const maxHueco = numero(d.maxGapMinutesAllowed);
    const cifras: CifraConUmbral[] = [];
    if (pct !== null && minPct !== null && pct < minPct) {
      cifras.push({ medido: `Cobertura ${cifra(pct)} %`, umbral: `mínimo ${cifra(minPct)} %` });
    }
    if (hueco !== null && maxHueco !== null && hueco > maxHueco) {
      cifras.push({ medido: `Hueco mayor ${cifra(hueco)} min`, umbral: `máximo ${cifra(maxHueco)} min` });
    }
    return {
      clave: "cobertura_insuficiente",
      corto: "señal insuficiente",
      largo:
        "La señal no alcanzó el mínimo que pide el contrato. Un hueco de datos nunca se juzga como incumplimiento.",
      cifras,
      nota: null,
    };
  }

  return NO_REGISTRADO;
}

function motivoDelNoCumplido(l: LecturaDelLedger): MotivoDelSello {
  if (!l.emparejado) return NO_REGISTRADO;
  const razon = l.decision?.details.reason;
  if (razon === "ninguna_unidad_coincidio_ruta") {
    return {
      clave: "ninguna_unidad_coincidio_ruta",
      corto: "nadie sirvió la ruta",
      largo: "Ninguna unidad de la evidencia recorrió el trazado de esta ruta hasta la geocerca de destino.",
      cifras: [],
      nota: null,
    };
  }
  if (razon === "ninguna_unidad_sirvio") {
    return {
      clave: "ninguna_unidad_sirvio",
      corto: "nadie llegó al destino",
      largo: "Ninguna unidad de la evidencia entró a la geocerca de destino en la ventana.",
      cifras: [],
      nota: null,
    };
  }
  return NO_REGISTRADO;
}

/**
 * El motivo de un sello, leído — nunca deducido.
 *
 * - **Cumplido:** todo sale del hecho (llegada, timing, llegada exigida,
 *   tolerancia congelada). La cifra es la llegada contra el umbral que decidió
 *   su timing.
 * - **Pendiente y no cumplido:** sale del ledger emparejado con el sello
 *   vigente. Sin emparejar, «Motivo no registrado en este sello».
 *
 * Una llegada tarde es **Cumplido · tarde**, no un no cumplido (Pieza 3: el
 * status es cumplido y «tarde» vive en timing). La consecuencia de llegar tarde
 * es enforcement, y no se decide aquí.
 */
export function motivoDelSello(h: HechoParaLeer, l: LecturaDelLedger, zona: string = JTTEL_TZ): MotivoDelSello {
  if (h.veredicto === "cumplido") return motivoDelCumplido(h, zona);
  if (h.veredicto === "pendiente_evidencia") return motivoDelPendiente(l);
  return motivoDelNoCumplido(l);
}

/** El nombre del veredicto con su timing: «Cumplido · tarde». */
export function veredictoEnPalabras(veredicto: Veredicto, timing: TimingDelSello | null): string {
  const nombre = NOMBRE_DEL_VEREDICTO[veredicto];
  return veredicto === "cumplido" && timing ? `${nombre} · ${PALABRA_DEL_TIMING[timing]}` : nombre;
}

/**
 * Extrae lo que el motivo necesita de los pasos de UNA entrada del ledger.
 * Tolera pasos mal formados: lo que no se entiende, no se lee.
 */
export function lecturaDePasos(pasos: unknown): LecturaDelLedger {
  if (!Array.isArray(pasos)) return { ...SIN_LEDGER, emparejado: true };
  type Paso = { step?: unknown; result?: unknown; details?: unknown };
  const lista = pasos as Paso[];
  const detalles = (p: Paso | undefined) =>
    p && typeof p.details === "object" && p.details !== null ? (p.details as Record<string, unknown>) : {};
  const resultado = (p: Paso | undefined) => (p && typeof p.result === "string" ? p.result : null);
  const decision = lista.find((p) => p?.step === "decision");
  const cobertura = lista.find((p) => p?.step === "cobertura_evidencia");
  return {
    emparejado: true,
    evidenciaIndisponible: lista.some((p) => p?.step === "evidencia" && p?.result === "indisponible"),
    decision: decision ? { result: resultado(decision), details: detalles(decision) } : null,
    cobertura: cobertura ? { result: resultado(cobertura), details: detalles(cobertura) } : null,
  };
}
