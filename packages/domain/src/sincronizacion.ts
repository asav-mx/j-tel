import { ed25519 } from "@noble/curves/ed25519.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import type { BoletoSellado } from "./boleto.js";
import { instanteZonificado, localDateIso } from "./tiempo.js";

/**
 * La sincronización del lector — Ontoy 3.0 · PR P3.5
 * (`docs/Ficha-Construccion-Ontoy-3-Pagos.md`).
 *
 * **Nada de aquí cobra.** Boletos de laboratorio, dinero de mentira; la valla
 * de `scripts/verificar-sin-cobro.mjs` está para que siga así.
 *
 * Todo lo de este módulo es **puro**: arma el lote, lo firma, lo verifica y
 * decide si un lector lleva demasiado tiempo callado. No habla con la base ni
 * con la red — eso vive en `packages/db` y en la ruta de `apps/publico`.
 *
 * ## Por qué el lote va firmado por el lector
 *
 * El lector escribe en el libro, y el libro no se puede editar después. Quien
 * pueda mandar un lote puede meter renglones que nadie va a poder quitar, así
 * que hace falta saber que el lote es de ese aparato.
 *
 * Se firma con Ed25519, la misma máquina que ya verifica boletos: el lector
 * guarda su llave privada y J-Tel registra la pública al darlo de alta. Un
 * secreto compartido habría sido más corto de escribir y acaba pegado en un
 * chat; una firma no se puede reusar para otro lote.
 *
 * **La baja revoca la llave en el instante** (corrección de Asav, 23-sep-2026):
 * un lote firmado por un lector dado de baja se rechaza, y el intento queda
 * registrado — que es lo que hace útil la revocación cuando el aparato está en
 * manos de alguien más.
 *
 * ## Y la firma del lote no basta
 *
 * Un lector robado tiene su llave privada: puede firmar lotes legítimos con
 * folios inventados. Por eso **cada quemado viaja con el boleto entero**, y el
 * servidor re-verifica la firma de J-Tel antes de escribir el renglón. La
 * firma del lote dice «esto lo mandó este aparato»; la del boleto dice «este
 * folio existe». Son dos preguntas distintas y hacen falta las dos.
 */

// ─────────────────────────────────────────────────────────────────────────────
// El lote

/** Cómo llegó el paso al lector. Lo mismo que `ViaDelPaso` en `validador.ts`. */
export type ViaEntregada = "qr" | "codigo_dictado";

/** Un paso que el lector aceptó y todavía no le consta a J-Tel. */
export interface PasoEntregado {
  /**
   * El id que el LECTOR le puso a este paso, no el servidor. Es lo que hace
   * que reenviar un lote no duplique renglones, y va por lector: dos lectores
   * distintos nunca compiten por la misma llave.
   */
  readonly paso: string;
  readonly folio: string;
  readonly via: ViaEntregada;
  /** Epoch ms del reloj del lector, que sin red puede venir corrido. */
  readonly cuando: number;
  readonly conSenal: boolean;
  /**
   * El boleto que se leyó, para que el servidor re-verifique la firma de J-Tel.
   *
   * **La vía dictada no lo trae y no puede traerlo**: ocho dígitos no son una
   * firma. Ese renglón entra al libro como reclamo, no como quemado.
   */
  readonly boleto?: BoletoSellado;
}

export interface LoteDelLector {
  /** El id del lector en el registro de J-Tel. */
  readonly lector: string;
  /** La fecha local del lector, `YYYY-MM-DD`: su jornada. */
  readonly dia: string;
  /** Epoch ms del reloj del lector al armar el lote. */
  readonly armadoEn: number;
  /** Puede venir vacío: **un lote sin pasos es el latido.** */
  readonly pasos: readonly PasoEntregado[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Qué se firma
//
// Los separadores no son adorno — la misma lección de `boleto.ts`: sin ellos,
// dos lotes distintos pueden serializarse igual y una firma valdría para otro.
// Hay separador Y hay `loteBienFormado`, porque el separador sólo sirve si
// ningún campo puede contenerlo.

const DOMINIO_DEL_LOTE = "j-tel/lote-del-lector/v1";
const CAMPO = "\t";
const RENGLON = "\n";

/** Lo que no puede contener ningún campo del lote, o la frontera se mueve. */
const SEPARADORES = /[\t\n]/;

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function textoSano(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && !SEPARADORES.test(valor);
}

/**
 * ¿Este lote se puede serializar sin ambigüedad?
 *
 * Lo que llega al servidor lo controla quien manda el lote, así que esto no es
 * paranoia de tipos: un folio con un tabulador adentro movería la frontera
 * entre dos campos y la firma dejaría de decir lo que parece decir.
 */
export function loteBienFormado(lote: LoteDelLector): boolean {
  if (!textoSano(lote.lector)) return false;
  if (!textoSano(lote.dia) || !FECHA_ISO.test(lote.dia)) return false;
  if (!Number.isSafeInteger(lote.armadoEn)) return false;
  if (!Array.isArray(lote.pasos)) return false;
  return lote.pasos.every((p) => {
    if (!textoSano(p.paso) || !textoSano(p.folio)) return false;
    if (p.via !== "qr" && p.via !== "codigo_dictado") return false;
    if (!Number.isSafeInteger(p.cuando)) return false;
    if (typeof p.conSenal !== "boolean") return false;
    /* El QR trae boleto; el dictado no puede traerlo — no verifica nada. */
    if (p.via === "qr" && !p.boleto) return false;
    if (p.via === "codigo_dictado" && p.boleto) return false;
    if (p.boleto && !textoSano(p.boleto.firmaDeJTel)) return false;
    return true;
  });
}

function serializarLote(lote: LoteDelLector): Uint8Array {
  const cabeza = [DOMINIO_DEL_LOTE, lote.lector, lote.dia, String(lote.armadoEn), String(lote.pasos.length)];
  const cuerpo = lote.pasos.map((p) =>
    [
      p.paso,
      p.folio,
      p.via,
      String(p.cuando),
      p.conSenal ? "1" : "0",
      p.boleto?.firmaDeJTel ?? "-",
    ].join(CAMPO),
  );
  return utf8ToBytes([...cabeza, ...cuerpo].join(RENGLON));
}

/** El lector firma su lote. La privada no sale del aparato. */
export function firmarLote(lote: LoteDelLector, privada: Uint8Array): string {
  if (!loteBienFormado(lote)) {
    throw new Error("No se firma un lote mal formado: un campo trae un separador o falta un dato.");
  }
  return bytesToHex(ed25519.sign(serializarLote(lote), privada));
}

/**
 * ¿Este lote lo mandó el aparato que dice?
 *
 * Un lote mal formado no se verifica: se rechaza. Y las llaves mal formadas
 * hacen que `verify` avente en vez de devolver `false`; para el servidor eso
 * es lo mismo que una firma que no cuadra, y no debe tumbar la ruta.
 */
export function verificarFirmaDelLote(
  lote: LoteDelLector,
  firmaHex: string,
  llavePublicaHex: string,
): boolean {
  if (!loteBienFormado(lote)) return false;
  try {
    return ed25519.verify(hexToBytes(firmaHex), serializarLote(lote), hexToBytes(llavePublicaHex));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// El doble uso, del lado del servidor
//
// `cotejarQuemados` (en `boleto.ts`) compara memorias enteras y sirve para
// mirar un día completo. El servidor tiene otra pregunta, una por renglón que
// entra: **este folio, ¿ya lo quemó otro aparato?**

/** Un quemado que ya está en el libro. Lo mínimo para decidir el hallazgo. */
export interface QuemadoEnElLibro {
  readonly operacionId: string;
  readonly lector: string;
  readonly cuando: number;
}

export interface HallazgoDeDobleUso {
  readonly folio: string;
  /** Los aparatos que lo quemaron, en orden de hora. Siempre dos o más. */
  readonly lectores: readonly string[];
  readonly operaciones: readonly string[];
}

/**
 * ¿El folio que acaba de entrar ya estaba quemado en otro aparato?
 *
 * **Entre aparatos, y sólo entre aparatos.** Dos renglones del mismo lector
 * con el mismo folio no son doble uso: el aparato ya rechaza el segundo paso
 * en el momento (`ya_quemado_en_este_aparato`), así que un segundo renglón de
 * ese lector sólo puede venir de un reenvío, y llamarlo hallazgo sería gritar
 * por algo que no pasó. Lo que el aparato no puede ver es al **otro** aparato.
 *
 * **Esto no deshace nada.** Los dos pasos ocurrieron y los dos se quedan como
 * renglón: el cotejo levanta el hallazgo, no lo corrige. La misma ley de la
 * medición que ya escribió `cotejarQuemados`.
 */
export function hallazgoDeDobleUso(
  folio: string,
  nuevo: QuemadoEnElLibro,
  yaEnElLibro: readonly QuemadoEnElLibro[],
): HallazgoDeDobleUso | null {
  const ajenos = yaEnElLibro.filter((q) => q.lector !== nuevo.lector);
  if (ajenos.length === 0) return null;
  const todos = [...ajenos, nuevo].sort(
    (a, b) => a.cuando - b.cuando || a.operacionId.localeCompare(b.operacionId),
  );
  return {
    folio,
    lectores: [...new Set(todos.map((q) => q.lector))],
    operaciones: todos.map((q) => q.operacionId),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// El lector que lleva rato sin hablar

/**
 * Cuántas horas **de servicio** puede estar un lector sin dar señales antes de
 * llamarlo mudo. Decidido por Asav el 23-sep-2026, y **provisional hasta
 * medir**: sale de cuánto dura un tramo sin cobertura en la ciudad, que nadie
 * ha medido todavía.
 *
 * De servicio, no de reloj: un camión dormido en el patio a las 3 de la mañana
 * no está mudo, está apagado. Contar horas corridas llamaría mudo a toda la
 * flota cada amanecer, y una alarma que suena siempre no se oye nunca.
 */
export const HORAS_DE_SERVICIO_PARA_MUDO = 4;

export interface HorarioDelServicio {
  /** `HH:MM` local del circuito. */
  readonly inicioLocal: string;
  readonly finLocal: string;
  readonly zona: string;
}

const minutosDe = (hhmm: string): number => {
  const [hh, mm] = hhmm.slice(0, 5).split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
};

/** Tope de días que se recorren, para que un `desde` absurdo no cuelgue la ruta. */
const DIAS_MAXIMOS = 40;

/**
 * La fecha civil `dias` después de otra, en aritmética de calendario pura.
 *
 * A propósito **sin zonas**: sumarle 24 h a un instante da el día equivocado
 * los dos días del año en que el reloj cambia, y aquí lo que se quiere es el
 * renglón siguiente del calendario, no un instante.
 */
function diaMas(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(anio!, mes! - 1, dia! + dias)).toISOString().slice(0, 10);
}

/**
 * Cuántas horas de servicio caben entre dos instantes, según el horario del
 * circuito.
 *
 * Se recorre día civil por día civil porque el horario es local y los dos días
 * del año en que cambia la hora no duran 24 h — `instanteZonificado` ya sabe
 * eso, y aquí se le pregunta por cada día en vez de suponerlo.
 */
export function horasDeServicioEntre(
  desde: number,
  hasta: number,
  horario: HorarioDelServicio,
): number {
  if (hasta <= desde) return 0;
  const inicio = minutosDe(horario.inicioLocal);
  const fin = minutosDe(horario.finLocal);
  /* Inicio y fin iguales es servicio de 24 h: no hay hueco que descontar. */
  if (inicio === fin) return (hasta - desde) / 3_600_000;

  let ms = 0;
  const primerDia = localDateIso(new Date(desde), horario.zona);
  /*
   * Se arranca un día ANTES: con un horario que cruza la medianoche —22:00 a
   * 02:00— el servicio en el que cae `desde` empezó ayer, y contar sólo desde
   * hoy perdería la madrugada entera sin que nada lo dijera.
   */
  for (let i = -1; i < DIAS_MAXIMOS; i += 1) {
    const dia = diaMas(primerDia, i);
    const abre = instanteZonificado(dia, inicio, horario.zona).getTime();
    /* Un horario que cruza la medianoche cierra al día siguiente. */
    const cierra = instanteZonificado(dia, fin < inicio ? fin + 24 * 60 : fin, horario.zona).getTime();
    if (abre > hasta) break;
    ms += Math.max(0, Math.min(cierra, hasta) - Math.max(abre, desde));
  }
  return ms / 3_600_000;
}

export type SaludDelLector =
  | { readonly estado: "en_contacto"; readonly horasDeServicioSinContacto: number }
  | { readonly estado: "mudo"; readonly horasDeServicioSinContacto: number }
  | { readonly estado: "no_se_puede_decir"; readonly motivo: "sin_circuito_asignado" };

/**
 * ¿Este lector está mudo?
 *
 * `ultimoContacto` es su última entrega aceptada **o su alta** si nunca ha
 * entregado nada: un lector recién dado de alta no lleva callado desde el
 * principio de los tiempos.
 *
 * Sin circuito asignado no hay horario, y sin horario no hay «horas de
 * servicio» que contar. Ahí no se contesta ni sí ni no: se dice que no se
 * puede decir, porque inventar un horario sería inventar la respuesta.
 */
export function saludDelLector(args: {
  readonly ultimoContacto: number;
  readonly ahora: number;
  readonly horario: HorarioDelServicio | null;
}): SaludDelLector {
  if (!args.horario) return { estado: "no_se_puede_decir", motivo: "sin_circuito_asignado" };
  const horas = horasDeServicioEntre(args.ultimoContacto, args.ahora, args.horario);
  return {
    estado: horas >= HORAS_DE_SERVICIO_PARA_MUDO ? "mudo" : "en_contacto",
    horasDeServicioSinContacto: horas,
  };
}
