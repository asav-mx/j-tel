import { partirEnHuecos, SALTO_GPS_KMH, type PuntoTraza } from "./huecos.js";
import { proyectarSobreTrazado } from "./trazado.js";
import { haversineKm } from "./ventana-observacion.js";

/**
 * La jornada de una unidad — su día en un circuito, **sólo con lo medido**.
 *
 * Una jornada = una unidad, un circuito, un día de servicio. Sale de lo que ya
 * está guardado (las posiciones archivadas, los pasos detectados, los trazados
 * y las perillas del circuito) y no escribe nada. Es **recuerdo, no vida**: no
 * califica, no compara y no nombra al chofer (ficha de la jornada, 21-sep-2026).
 *
 * ## Qué se puede afirmar — y ante la duda, SIN DATOS
 *
 * El umbral del silencio es el de edad del circuito (`staleAfterSeconds`, 180 s
 * de fábrica), **no** los 15 min con los que Ver ‹unidad› parte su dibujo.
 * Decisión de ASAV del 21-sep: aquí no se decide dónde partir una línea, sino
 * qué se puede afirmar, y dentro de un silencio no se afirma nada — ni
 * recorrido, ni salida, ni que faltó una parada (Pieza 1: esperado ≠
 * observado). La hoja dice con qué umbral cortó.
 *
 * ## Las cuatro derivaciones
 *
 * 1. **Silencios** — hueco entre dos posiciones mayor que el umbral.
 * 2. **Salidas del corredor** — posiciones seguidas más lejos que la
 *    tolerancia del trazado de su sentido, sostenidas `minutosFuera` o más
 *    (el brinco del GPS no cuenta). Un silencio parte la racha: lo que pasó
 *    dentro de él no se mide.
 * 3. **Vueltas** — pasos del mismo sentido en el orden de sus paradas. Una
 *    vuelta nueva empieza cuando cambia el sentido o cuando la unidad regresa a
 *    una parada anterior.
 * 4. **Las paradas que faltan**, con la misma regla en cualquier parte de la
 *    vuelta (al principio, en medio o al final), y en este orden de precedencia:
 *      · después de lo que el detector ya procesó → **todavía no se mide**;
 *      · el tramo cae (aunque sea en parte) en un silencio → **SIN DATOS**;
 *      · al principio, y la unidad venía de fuera del corredor → **entró al
 *        corredor en ‹parada›**; en medio o al final, con una salida medida en
 *        ese tramo → **salió del corredor en ‹parada›**;
 *      · nada lo explica → se listan las paradas **sin adjetivo**: puede ser el
 *        detector, y no se le achaca a nadie.
 *
 * **«Cortada» no existe aquí** (ficha, corrección 1): implica una intención que
 * nadie midió. La frase dice lo que pasó.
 */

/** Minutos seguidos fuera del corredor para que cuente como salida. De fábrica; se calibra con camiones reales. */
export const MINUTOS_FUERA_DEL_CORREDOR = 3;

export type SentidoDeJornada = "ida" | "vuelta";

export interface ParadaDeJornada {
  stopId: string;
  nombre: string;
  /** `null` sirve a los dos sentidos. */
  sentido: SentidoDeJornada | null;
  lat: number;
  lon: number;
}

export interface PasoDeJornada {
  stopId: string;
  sentido: SentidoDeJornada;
  pasoDesde: Date;
  pasoHasta: Date;
}

export interface TrazadoDeJornada {
  sentido: SentidoDeJornada;
  /** [lon, lat], como los guarda el circuito. */
  coordinates: Array<[number, number]>;
}

export interface Silencio {
  desde: Date;
  hasta: Date;
  minutos: number;
}

export interface SalidaDelCorredor {
  /** Primera y última posición medidas fuera. */
  desde: Date;
  hasta: Date;
  minutos: number;
  /** Cómo terminó la racha: volvió al corredor, la cortó un silencio, o se acabó la jornada. */
  termina: "volvio" | "silencio" | "fin";
}

export type CausaDeLoQueFalta =
  | { tipo: "todavia_no_se_mide" }
  | { tipo: "sin_datos" }
  | { tipo: "entro_al_corredor"; stopId: string; nombre: string }
  | { tipo: "salio_del_corredor"; stopId: string; nombre: string }
  | { tipo: "sin_causa_medida" };

export interface ParadasSinPaso {
  donde: "principio" | "medio" | "final";
  paradas: Array<{ stopId: string; nombre: string }>;
  /** El tramo de tiempo donde tendrían que haber caído. */
  desde: Date;
  hasta: Date;
  causa: CausaDeLoQueFalta;
}

export type EstadoDeVuelta =
  | "completa"
  | "incompleta"
  | "sin_datos"
  | "paradas_sin_paso"
  | "todavia_no_se_mide";

export interface VueltaDeJornada {
  sentido: SentidoDeJornada;
  desde: Date;
  hasta: Date;
  pasos: Array<{ stopId: string; nombre: string; pasoDesde: Date; pasoHasta: Date }>;
  paradasDelSentido: number;
  faltan: ParadasSinPaso[];
  estado: EstadoDeVuelta;
}

export interface CifrasDeJornada {
  vueltas: Record<EstadoDeVuelta, number>;
  minutosDeSilencio: number;
  minutosFueraDelCorredor: number;
  /** Sólo entre posiciones sin silencio de por medio: dentro de un silencio no hay recorrido. */
  kmMedidos: number;
}

export interface Jornada {
  ventana: { desde: Date; hasta: Date };
  /** Hasta dónde procesó el detector. `null`: todavía nada. */
  medidoHasta: Date | null;
  umbrales: { silencioSegundos: number; corredorMetros: number; minutosFuera: number };
  silencios: Silencio[];
  salidas: SalidaDelCorredor[];
  vueltas: VueltaDeJornada[];
  cifras: CifrasDeJornada;
}

export interface EntradaDeJornada {
  /** El día de servicio, ya acotado a «ahora» si es hoy. */
  ventana: { desde: Date; hasta: Date };
  /**
   * Posiciones de la unidad, en cualquier orden. **Pueden traer margen antes y
   * después de la ventana**, y conviene: sirven sólo para saber si había señal
   * en los bordes (un camión encendido desde las 5:40 SÍ tiene evidencia a las
   * 6:00). Las cifras —silencio, km, salidas— se cuentan dentro de la ventana.
   */
  puntos: PuntoTraza[];
  paradas: ParadaDeJornada[];
  pasos: PasoDeJornada[];
  trazados: TrazadoDeJornada[];
  medidoHasta: Date | null;
  silencioSegundos: number;
  corredorMetros: number;
  minutosFuera?: number;
}

const MIN = 60_000;
const minutosEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MIN;

/* ─── 1. Silencios ──────────────────────────────────────────────────────── */

/** Los tramos con señal continua: entre dos puntos seguidos nunca más que el umbral. */
export function tramosConSenal(puntos: PuntoTraza[], silencioSegundos: number): PuntoTraza[][] {
  return partirEnHuecos(ordenar(puntos), silencioSegundos / 60);
}

export function silenciosDeLaJornada(puntos: PuntoTraza[], silencioSegundos: number): Silencio[] {
  const tramos = tramosConSenal(puntos, silencioSegundos);
  const salida: Silencio[] = [];
  for (let i = 1; i < tramos.length; i += 1) {
    const desde = tramos[i - 1]!.at(-1)!.at;
    const hasta = tramos[i]![0]!.at;
    salida.push({ desde, hasta, minutos: minutosEntre(desde, hasta) });
  }
  return salida;
}

/**
 * ¿Hay señal continua en todo el intervalo? Sólo si UN tramo con señal lo cubre
 * de punta a punta. Antes del primer punto o después del último tampoco hay
 * evidencia: ante la duda, no.
 */
export function cubiertoPorSenal(tramos: PuntoTraza[][], desde: Date, hasta: Date): boolean {
  return tramos.some((t) => t[0]!.at.getTime() <= desde.getTime() && t.at(-1)!.at.getTime() >= hasta.getTime());
}

/* ─── 3. Vueltas (se arman antes que las salidas: dan el sentido) ───────── */

/** Las paradas de un sentido, ordenadas por dónde caen sobre su trazado. */
export function paradasDelSentido(
  paradas: ParadaDeJornada[],
  trazado: Array<[number, number]> | null,
  sentido: SentidoDeJornada,
): ParadaDeJornada[] {
  const delSentido = paradas.filter((p) => p.sentido === null || p.sentido === sentido);
  if (!trazado || trazado.length < 2) return delSentido;
  return delSentido
    .map((p) => ({ p, avance: proyectarSobreTrazado({ lat: p.lat, lon: p.lon }, trazado)?.avanceMetros ?? 0 }))
    .sort((a, b) => a.avance - b.avance)
    .map((x) => x.p);
}

interface VueltaCruda {
  sentido: SentidoDeJornada;
  pasos: Array<PasoDeJornada & { indice: number }>;
}

/**
 * Parte los pasos en vueltas: mismo sentido y avanzando en el orden de sus
 * paradas. Un paso que regresa (o repite) abre otra vuelta en vez de
 * esconderse dentro de la anterior. Un paso de una parada que no está en su
 * sentido no se usa: no hay dónde ponerlo.
 */
export function partirEnVueltas(
  pasos: PasoDeJornada[],
  ordenPorSentido: Record<SentidoDeJornada, ParadaDeJornada[]>,
): VueltaCruda[] {
  const indice = {
    ida: new Map(ordenPorSentido.ida.map((p, i) => [p.stopId, i])),
    vuelta: new Map(ordenPorSentido.vuelta.map((p, i) => [p.stopId, i])),
  };
  const vueltas: VueltaCruda[] = [];
  for (const paso of [...pasos].sort((a, b) => a.pasoDesde.getTime() - b.pasoDesde.getTime())) {
    const i = indice[paso.sentido].get(paso.stopId);
    if (i === undefined) continue;
    const actual = vueltas.at(-1);
    if (actual && actual.sentido === paso.sentido && i > actual.pasos.at(-1)!.indice) {
      actual.pasos.push({ ...paso, indice: i });
    } else {
      vueltas.push({ sentido: paso.sentido, pasos: [{ ...paso, indice: i }] });
    }
  }
  return vueltas;
}

/* ─── 2. Salidas del corredor ───────────────────────────────────────────── */

/**
 * El sentido de cada instante: el de la vuelta que lo contiene. Fuera de toda
 * vuelta, `null` — y entonces un punto está fuera sólo si está lejos de LOS
 * DOS trazados (no se le asigna un sentido que nadie midió).
 */
function sentidoEn(vueltas: VueltaCruda[], at: Date): SentidoDeJornada | null {
  const t = at.getTime();
  for (const v of vueltas) {
    if (v.pasos[0]!.pasoDesde.getTime() <= t && t <= v.pasos.at(-1)!.pasoHasta.getTime()) return v.sentido;
  }
  return null;
}

function distanciaAlTrazado(
  punto: PuntoTraza,
  trazados: TrazadoDeJornada[],
  sentido: SentidoDeJornada | null,
): number | null {
  const candidatos = trazados.filter((t) => sentido === null || t.sentido === sentido);
  let mejor: number | null = null;
  for (const t of candidatos) {
    const d = proyectarSobreTrazado({ lat: punto.lat, lon: punto.lng }, t.coordinates)?.distanciaMetros;
    if (d !== undefined && (mejor === null || d < mejor)) mejor = d;
  }
  return mejor;
}

export function salidasDelCorredor(e: {
  tramos: PuntoTraza[][];
  trazados: TrazadoDeJornada[];
  vueltas: VueltaCruda[];
  corredorMetros: number;
  minutosFuera: number;
}): SalidaDelCorredor[] {
  const salidas: SalidaDelCorredor[] = [];
  e.tramos.forEach((tramo, iTramo) => {
    let racha: PuntoTraza[] = [];
    const cerrar = (termina: SalidaDelCorredor["termina"]) => {
      if (racha.length > 0) {
        const desde = racha[0]!.at;
        const hasta = racha.at(-1)!.at;
        const minutos = minutosEntre(desde, hasta);
        if (minutos >= e.minutosFuera) salidas.push({ desde, hasta, minutos, termina });
      }
      racha = [];
    };
    for (const p of tramo) {
      const d = distanciaAlTrazado(p, e.trazados, sentidoEn(e.vueltas, p.at));
      if (d !== null && d > e.corredorMetros) racha.push(p);
      else cerrar("volvio");
    }
    // Se acaba el tramo con la racha abierta: o viene un silencio, o se acabó la jornada.
    cerrar(iTramo < e.tramos.length - 1 ? "silencio" : "fin");
  });
  return salidas;
}

/* ─── 4. Lo que falta, y la vuelta ──────────────────────────────────────── */

const seTocan = (a: { desde: Date; hasta: Date }, desde: Date, hasta: Date) =>
  a.desde.getTime() <= hasta.getTime() && a.hasta.getTime() >= desde.getTime();

function causaDe(e: {
  donde: ParadasSinPaso["donde"];
  desde: Date;
  hasta: Date;
  medidoHasta: Date | null;
  tramos: PuntoTraza[][];
  salidas: SalidaDelCorredor[];
  ancla: { stopId: string; nombre: string };
}): CausaDeLoQueFalta {
  if (e.medidoHasta === null || e.hasta.getTime() > e.medidoHasta.getTime()) return { tipo: "todavia_no_se_mide" };
  if (!cubiertoPorSenal(e.tramos, e.desde, e.hasta)) return { tipo: "sin_datos" };
  const salida = e.salidas.find((s) => seTocan(s, e.desde, e.hasta));
  if (salida) {
    return e.donde === "principio"
      ? { tipo: "entro_al_corredor", ...e.ancla }
      : { tipo: "salio_del_corredor", ...e.ancla };
  }
  return { tipo: "sin_causa_medida" };
}

function estadoDe(faltan: ParadasSinPaso[]): EstadoDeVuelta {
  if (faltan.length === 0) return "completa";
  const tipos = new Set(faltan.map((f) => f.causa.tipo));
  if (tipos.has("todavia_no_se_mide")) return "todavia_no_se_mide";
  // El silencio manda: una vuelta con un tramo sin evidencia no se declara incompleta.
  if (tipos.has("sin_datos")) return "sin_datos";
  if (tipos.has("entro_al_corredor") || tipos.has("salio_del_corredor")) return "incompleta";
  return "paradas_sin_paso";
}

/* ─── La jornada ────────────────────────────────────────────────────────── */

export function armarJornada(e: EntradaDeJornada): Jornada {
  const minutosFuera = e.minutosFuera ?? MINUTOS_FUERA_DEL_CORREDOR;
  const { desde: v0, hasta: v1 } = e.ventana;
  const dentro = (d: Date) => d.getTime() >= v0.getTime() && d.getTime() <= v1.getTime();
  const tramos = tramosConSenal(e.puntos, e.silencioSegundos);
  // El silencio se reporta recortado al día: lo de antes de abrir no es de esta jornada.
  const silencios = silenciosDeLaJornada(e.puntos, e.silencioSegundos)
    .filter((x) => seTocan(x, v0, v1))
    .map((x) => {
      const desde = x.desde < v0 ? v0 : x.desde;
      const hasta = x.hasta > v1 ? v1 : x.hasta;
      return { desde, hasta, minutos: minutosEntre(desde, hasta) };
    });

  const trazadoDe = (s: SentidoDeJornada) => e.trazados.find((t) => t.sentido === s)?.coordinates ?? null;
  const orden: Record<SentidoDeJornada, ParadaDeJornada[]> = {
    ida: paradasDelSentido(e.paradas, trazadoDe("ida"), "ida"),
    vuelta: paradasDelSentido(e.paradas, trazadoDe("vuelta"), "vuelta"),
  };
  const nombreDe = new Map(e.paradas.map((p) => [p.stopId, p.nombre]));

  const pasos = e.pasos.filter((p) => dentro(p.pasoDesde));
  const crudas = partirEnVueltas(pasos, orden);
  const todasLasSalidas = salidasDelCorredor({
    tramos,
    trazados: e.trazados,
    vueltas: crudas,
    corredorMetros: e.corredorMetros,
    minutosFuera,
  });
  // Las de los márgenes explican bordes (entró al corredor), pero no son de este día.
  const salidas = todasLasSalidas.filter((x) => seTocan(x, v0, v1));

  const vueltas: VueltaDeJornada[] = crudas.map((v, iv) => {
    const delSentido = orden[v.sentido];
    const faltan: ParadasSinPaso[] = [];
    const agregar = (
      donde: ParadasSinPaso["donde"],
      de: number,
      a: number,
      desde: Date,
      hasta: Date,
      ancla: { stopId: string; nombre: string },
    ) => {
      if (a < de) return;
      faltan.push({
        donde,
        paradas: delSentido.slice(de, a + 1).map((p) => ({ stopId: p.stopId, nombre: p.nombre })),
        desde,
        hasta,
        causa: causaDe({ donde, desde, hasta, medidoHasta: e.medidoHasta, tramos, salidas: todasLasSalidas, ancla }),
      });
    };
    const ancla = (i: number) => ({ stopId: delSentido[i]!.stopId, nombre: delSentido[i]!.nombre });

    const primero = v.pasos[0]!;
    const ultimo = v.pasos.at(-1)!;
    const anterior = crudas[iv - 1]?.pasos.at(-1)?.pasoHasta ?? e.ventana.desde;
    const siguiente = crudas[iv + 1]?.pasos[0]?.pasoDesde ?? e.ventana.hasta;

    // Al principio: desde que terminó la vuelta anterior (o abrió el día) hasta su primer paso.
    agregar("principio", 0, primero.indice - 1, anterior, primero.pasoDesde, ancla(primero.indice));
    // En medio: entre cada par de pasos que se brincó paradas.
    for (let i = 1; i < v.pasos.length; i += 1) {
      const a = v.pasos[i - 1]!;
      const b = v.pasos[i]!;
      agregar("medio", a.indice + 1, b.indice - 1, a.pasoHasta, b.pasoDesde, ancla(a.indice));
    }
    // Al final: desde su último paso hasta que empezó la siguiente (o se acabó el día).
    agregar("final", ultimo.indice + 1, delSentido.length - 1, ultimo.pasoHasta, siguiente, ancla(ultimo.indice));

    return {
      sentido: v.sentido,
      desde: primero.pasoDesde,
      hasta: ultimo.pasoHasta,
      pasos: v.pasos.map((p) => ({
        stopId: p.stopId,
        nombre: nombreDe.get(p.stopId) ?? "",
        pasoDesde: p.pasoDesde,
        pasoHasta: p.pasoHasta,
      })),
      paradasDelSentido: delSentido.length,
      faltan,
      estado: estadoDe(faltan),
    };
  });

  const conteo: Record<EstadoDeVuelta, number> = {
    completa: 0,
    incompleta: 0,
    sin_datos: 0,
    paradas_sin_paso: 0,
    todavia_no_se_mide: 0,
  };
  for (const v of vueltas) conteo[v.estado] += 1;

  // Km dentro del día, sin cruzar silencios y sin los saltos del GPS (misma regla que el recorrido).
  let km = 0;
  for (const t of tramos) {
    for (let i = 1; i < t.length; i += 1) {
      const a = t[i - 1]!;
      const b = t[i]!;
      if (!dentro(a.at) || !dentro(b.at)) continue;
      const tramoKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
      const horas = (b.at.getTime() - a.at.getTime()) / 3_600_000;
      if (horas > 0 && tramoKm / horas > SALTO_GPS_KMH) continue;
      km += tramoKm;
    }
  }

  return {
    ventana: e.ventana,
    medidoHasta: e.medidoHasta,
    umbrales: { silencioSegundos: e.silencioSegundos, corredorMetros: e.corredorMetros, minutosFuera },
    silencios,
    salidas,
    vueltas,
    cifras: {
      vueltas: conteo,
      minutosDeSilencio: silencios.reduce((s, x) => s + x.minutos, 0),
      minutosFueraDelCorredor: salidas.reduce((s, x) => s + x.minutos, 0),
      kmMedidos: km,
    },
  };
}

function ordenar(puntos: PuntoTraza[]): PuntoTraza[] {
  return [...puntos].sort((a, b) => a.at.getTime() - b.at.getTime());
}
