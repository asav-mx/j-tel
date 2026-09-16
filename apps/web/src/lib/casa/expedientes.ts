/**
 * El cuarto de Expedientes, puesto en palabras y formas.
 *
 * Los estados vienen de `@jtel/domain` y `@jtel/services`; aquí se decide cómo
 * se ven: qué glifo, qué número, qué palabra. Vive aparte de las páginas para
 * poder probarse, y para que el cuarto, la ficha de la unidad y la del papel
 * digan lo mismo del mismo estado — si cada página tradujera por su cuenta, un
 * «por vencer» podría llamarse de dos formas.
 *
 * Gobierna `docs/Ficha-Expedientes.md` y el skill `jtel-diseno` (los glifos, el
 * número en el vistazo, el número con su umbral en la decisión).
 */

import type {
  EstadoDeDispositivo,
  EstadoDePapel,
  EstadoDeUnidad,
  FuentePendiente,
  NombreDeEstadoDePapel,
  ResumenDePapeles,
} from "@jtel/domain";
import type { EstadoGlifo } from "@/components/casa/glifo";

export const RAIZ_EXPEDIENTES = "/casa/transportista/expedientes";

/** Las rutas del cuarto, con la cuenta cuando hace falta decirla. */
export const rutas = {
  cuarto: (cuenta?: string | null) => conCuenta(RAIZ_EXPEDIENTES, cuenta),
  unidad: (id: string, cuenta?: string | null) => conCuenta(`${RAIZ_EXPEDIENTES}/unidad/${id}`, cuenta),
  papel: (unidadId: string, tipoId: string, cuenta?: string | null, accion?: "capturar" | "corregir" | "renovar") =>
    conCuenta(`${RAIZ_EXPEDIENTES}/unidad/${unidadId}/papel/${tipoId}${accion ? `?accion=${accion}` : ""}`, cuenta),
  dispositivo: (id: string, cuenta?: string | null) => conCuenta(`${RAIZ_EXPEDIENTES}/dispositivo/${id}`, cuenta),
};

function conCuenta(ruta: string, cuenta?: string | null): string {
  if (!cuenta) return ruta;
  return `${ruta}${ruta.includes("?") ? "&" : "?"}account=${encodeURIComponent(cuenta)}`;
}

// ── Papeles ──────────────────────────────────────────────────────────────

const GLIFO_DE_PAPEL: Record<NombreDeEstadoDePapel, EstadoGlifo | null> = {
  vencido: "papel-vencido",
  por_vencer: "papel-por-vencer",
  falta: "papel-falta",
  falta_la_fecha: "papel-falta-la-fecha",
  falta_la_regla: "papel-falta-la-regla",
  vigente: "papel-vigente",
  sin_vencimiento: "papel-sin-vencimiento",
  // Opcional y ausente: sin pieza (aprobado el 16 sep 2026).
  no_capturado: null,
};

export function glifoDePapel(estado: NombreDeEstadoDePapel): EstadoGlifo | null {
  return GLIFO_DE_PAPEL[estado];
}

/** Lo que ya está al día se apaga. */
export function papelApagado(estado: NombreDeEstadoDePapel): boolean {
  return estado === "vigente" || estado === "sin_vencimiento";
}

/**
 * El número del vistazo y su palabra (skill: un solo número).
 *
 * Un papel sin regla muestra sus días si los tiene: «en 12 d» no supone
 * ninguna regla; llamarlo vigente o por vencer, sí.
 */
export function datoDePapel(e: EstadoDePapel): { dato: string; etiqueta: string } {
  switch (e.estado) {
    case "vencido":
      return { dato: `hace ${e.diasVencido} d`, etiqueta: "venció" };
    case "por_vencer":
    case "vigente":
      return { dato: e.diasRestantes === 0 ? "hoy" : `en ${e.diasRestantes} d`, etiqueta: "vence" };
    case "sin_vencimiento":
      return { dato: "—", etiqueta: "no vence" };
    case "falta":
      return { dato: "—", etiqueta: "falta" };
    case "falta_la_fecha":
      return { dato: "—", etiqueta: "sin fecha" };
    case "falta_la_regla":
      return {
        dato: e.diasRestantes === null ? "—" : e.diasRestantes === 0 ? "hoy" : `en ${e.diasRestantes} d`,
        etiqueta: "sin regla",
      };
    case "no_capturado":
      return { dato: "—", etiqueta: "opcional" };
  }
}

/** El titular del papel en su ficha, donde se decide. */
export function titularDePapel(e: EstadoDePapel): string {
  switch (e.estado) {
    case "vencido":
      return e.diasVencido === 1 ? "Venció ayer" : `Venció hace ${e.diasVencido} días`;
    case "por_vencer":
    case "vigente":
      return e.diasRestantes === 0 ? "Vence hoy" : e.diasRestantes === 1 ? "Vence mañana" : `Vence en ${e.diasRestantes} días`;
    case "sin_vencimiento":
      return "No vence";
    case "falta":
      return "Falta";
    case "falta_la_fecha":
      return "Falta la fecha";
    case "falta_la_regla":
      return "Falta la regla";
    case "no_capturado":
      return "Sin capturar";
  }
}

const PIEZA_DE_REGLA: Record<"obligatorio" | "vence" | "dias_de_aviso", string> = {
  obligatorio: "si es obligatorio",
  vence: "si vence",
  dias_de_aviso: "sus días de aviso",
};

/**
 * El umbral: la fecha y la regla de su tipo, juntas (skill: en la decisión, el
 * número con su umbral).
 */
export function umbralDePapel(
  e: EstadoDePapel,
  diasDeAviso: number | null,
): string | null {
  switch (e.estado) {
    case "vencido":
      return `vencía el ${fechaCorta(e.venceEl)}`;
    case "por_vencer":
    case "vigente":
      return `vence el ${fechaCorta(e.venceEl)} · aviso de su tipo: ${diasDeAviso ?? "—"} d`;
    case "falta_la_regla":
      return `${e.venceEl ? `vence el ${fechaCorta(e.venceEl)} · ` : ""}el catálogo todavía no dice ${PIEZA_DE_REGLA[e.falta]}`;
    case "falta_la_fecha":
      return "el papel se capturó sin fecha de vencimiento, y su tipo vence";
    case "falta":
      return "es obligatorio y no se ha capturado";
    default:
      return null;
  }
}

/** La palabra del resumen de una unidad en el cuarto. */
export function datoDeResumen(r: ResumenDePapeles): { dato: string; etiqueta: string } {
  if (r.pidenAlgo > 0) return { dato: String(r.pidenAlgo), etiqueta: r.pidenAlgo === 1 ? "pide algo" : "piden algo" };
  if (r.faltaLaRegla > 0) return { dato: "—", etiqueta: "sin regla" };
  if (r.estaAlDia) return { dato: "0", etiqueta: "al día" };
  return { dato: "—", etiqueta: "sin papeles" };
}

// ── Unidades y dispositivos ──────────────────────────────────────────────

export function glifoDeUnidad(e: EstadoDeUnidad): { glifo: EstadoGlifo; rumbo?: number; palabra: string } {
  switch (e.tipo) {
    case "en_linea":
      if (e.postura === "en_movimiento") return { glifo: "en-movimiento", rumbo: e.rumbo ?? 0, palabra: "En movimiento" };
      // Sin velocidad no se afirma rumbo; el círculo lleno dice «presente».
      return { glifo: "detenida", palabra: e.postura === "detenida" ? "Detenida" : "En línea" };
    case "sin_senal":
      return { glifo: "sin-senal", palabra: "Sin señal" };
    case "desconectado":
      return { glifo: "sin-transmitir", palabra: "Desconectada" };
    case "sin_dispositivo":
      return { glifo: "sin-transmitir", palabra: "Sin dispositivo" };
  }
}

export function glifoDeDispositivo(e: EstadoDeDispositivo): { glifo: EstadoGlifo; palabra: string } {
  switch (e.grupo) {
    case "en_unidad":
      return { glifo: "dispositivo-en-unidad", palabra: "En unidad" };
    case "en_bodega":
      return { glifo: "dispositivo-en-bodega", palabra: "En bodega" };
    case "desconectado":
      return { glifo: "dispositivo-desconectado", palabra: "Desconectado" };
    case "de_baja":
      return { glifo: "dispositivo-de-baja", palabra: "De baja" };
  }
}

// ── Lo que todavía no tiene fuente ───────────────────────────────────────

const LLEGA_CON: Record<FuentePendiente, string> = {
  flota_en_vivo: "Aún no disponible · llega con Flota en vivo",
  asignacion_de_choferes: "Aún no disponible · llega con la asignación de choferes",
  mercado_de_la_cuenta: "Aún no disponible · la cuenta no tiene mercado",
};

export function aunNoDisponibleEnPalabras(fuente: FuentePendiente): string {
  return LLEGA_CON[fuente];
}

// ── Tiempo, escrito para leerse ─────────────────────────────────────────

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** `2026-09-13` → `13 sep 2026`. Sin comas: se arma con las partes. */
export function fechaCorta(fechaIso: string): string {
  const [y, m, d] = fechaIso.split("-").map(Number);
  return `${d} ${MESES[(m ?? 1) - 1]} ${y}`;
}

/** Un instante como fecha civil corta en la zona dada: `12 sep 2026`. */
export function diaDe(instante: Date, timeZone: string): string {
  return fechaCorta(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instante));
}

/**
 * La edad de un dato vivo: `hace 14 s`, `hace 2 min`, `hace 3.8 h`, `hace 3 d`.
 *
 * Una decimal en horas porque 3.8 h y 3 h no son lo mismo para quien espera un
 * camión; ninguna en lo demás. Sin «~»: los instrumentos no redondean a ojo.
 */
export function edad(instante: Date, ahora: Date): string {
  const s = Math.max(0, Math.round((ahora.getTime() - instante.getTime()) / 1000));
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = s / 3600;
  if (h < 24) return `hace ${h.toFixed(1)} h`;
  return `hace ${Math.floor(h / 24)} d`;
}
