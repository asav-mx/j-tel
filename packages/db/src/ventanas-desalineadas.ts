/**
 * La ventana congelada — Frente A: revisar lo que todavía no se ha juzgado.
 *
 * Hermano de `horas-limite.ts`, y a propósito: **es el mismo mecanismo en otro
 * campo.** `trips.evidence_window_start` se calcula al crear el viaje y **nadie
 * la vuelve a mirar**; la derivación aprende de la historia de cada ruta, y esa
 * historia crece. La ventana que hoy se derivaría para un servicio de la semana
 * que viene **no es la que ya se le congeló**.
 *
 * Es la forma de C21 —*congelar sin forma de revisar es el patrón, no el
 * campo*— en un tercer campo, después de la hora límite y la geocerca.
 *
 * ---
 *
 * ## Solo mira lo que NO se ha juzgado
 *
 * Un hecho sellado no se toca: mover su ventana sería reescribir el marco con
 * el que ya se decidió, y eso es re-verificar (D4). Aquí se miran las
 * ocurrencias **sin hecho**, donde corregir todavía es corregir y no es
 * reescribir.
 *
 * ## No corrige — y eso es la decisión, no una limitación
 *
 * Igual que su hermano: **corregir la ventana con la que se va a juzgar a un
 * transportista es decisión de Asav**, no de un programa. Un cron que corrige en
 * silencio no se distingue de uno que no corre (regla 8), y su resultado llega
 * sellado a un cliente.
 *
 * ## El cero es una afirmación
 *
 * Se devuelve `revisadas` junto a las desalineadas. Con la ventana rodante
 * generando treinta días por adelantado, **cero ocurrencias que revisar no es
 * salud: es una lectura rota**, y quien llame tiene que poder distinguirlas.
 */
import {
  computeEvidenceWindow,
  summarizeRouteDuration,
  routeLengthKm,
  type ContractPolicy,
  type RouteDurationSample,
} from "@jtel/domain";
import type { Repositories } from "./repositories/index.js";

export type VentanaDesalineada = {
  ocurrenciaId: string;
  contratoId: string;
  contratoNombre: string;
  clienteNombre: string;
  routeShiftId: string;
  rutaNombre: string;
  turnoNombre: string;
  serviceDate: string;
  /** Minutos que la ventana congelada abre antes del deadline. */
  congeladaMinutos: number;
  /** Minutos que hoy se derivarían con la historia que existe ahora. */
  derivadaMinutos: number;
  /** Positivo = hoy abriría ANTES; negativo = abriría después. */
  difMinutos: number;
  /**
   * De dónde sale la ventana de hoy. Separa las dos causas: `medida` es la
   * historia creciendo —lo esperado—, `politica` es que alguien movió una
   * perilla. **El aviso no puede mezclarlas: tienen dueños distintos.**
   */
  baseHoy: "medida" | "estimada_geometria" | "politica";
  /** Cuántas muestras de duración tiene hoy esa ruta×turno. */
  muestras: number;
  /**
   * La ventana que hoy se derivaría, completa.
   *
   * Se carga aquí para que **el corrector escriba exactamente lo que el
   * detector midió**. Si el corrector volviera a derivarla por su cuenta,
   * detectar y corregir serían dos cálculos que pueden separarse, y el aviso
   * hablaría de un número que la escritura no usa.
   */
  ventanaHoy: { inicio: Date; fin: Date };
};

export type RevisionDeVentanas = {
  /** Cuántas ocurrencias sin sellar se examinaron. Ver «el cero es una afirmación». */
  revisadas: number;
  desalineadas: VentanaDesalineada[];
};

/**
 * Un grupo por ruta×turno, que es como se avisa.
 *
 * **No por servicio**: si un ruta-turno se desalineó, se desalinearon sus treinta
 * ocurrencias futuras, y treinta renglones idénticos no son treinta hallazgos.
 */
export type GrupoDeVentanas = {
  routeShiftId: string;
  contratoNombre: string;
  rutaNombre: string;
  turnoNombre: string;
  ocurrencias: number;
  /**
   * La congelada es un RANGO, no un número.
   *
   * Cada ocurrencia se congeló en el momento en que se generó, y la historia
   * seguía creciendo entre una y otra: dentro de un mismo ruta×turno conviven
   * ventanas de 60 y de 120 minutos. La primera versión de esto guardaba la del
   * primer servicio y la presentaba como la del grupo — **un dato correcto
   * convertido en una afirmación falsa por la agrupación** (Marco §D). Con 38
   * de 47 grupos mezclados, el aviso decía «congelada 60 min» de grupos donde
   * casi ningún servicio tenía 60.
   */
  congeladaMin: number;
  congeladaMax: number;
  /** La de hoy sí es una sola por grupo: sale de la historia del ruta×turno. */
  derivadaMinutos: number;
  /** Cuántas se ENSANCHAN y cuántas se ANGOSTAN. No se suman: ver el aviso. */
  ensanchan: number;
  angostan: number;
  baseHoy: VentanaDesalineada["baseHoy"];
  muestras: number;
  /** La fecha de servicio más próxima del grupo — la que urge. */
  proxima: string;
};

export function agruparPorRutaTurno(
  desalineadas: VentanaDesalineada[],
): GrupoDeVentanas[] {
  const grupos = new Map<string, GrupoDeVentanas>();
  for (const d of desalineadas) {
    const ya = grupos.get(d.routeShiftId);
    if (ya) {
      ya.ocurrencias++;
      ya.congeladaMin = Math.min(ya.congeladaMin, d.congeladaMinutos);
      ya.congeladaMax = Math.max(ya.congeladaMax, d.congeladaMinutos);
      if (d.difMinutos > 0) ya.ensanchan++;
      else if (d.difMinutos < 0) ya.angostan++;
      if (d.serviceDate < ya.proxima) ya.proxima = d.serviceDate;
      continue;
    }
    grupos.set(d.routeShiftId, {
      routeShiftId: d.routeShiftId,
      contratoNombre: d.contratoNombre,
      rutaNombre: d.rutaNombre,
      turnoNombre: d.turnoNombre,
      ocurrencias: 1,
      congeladaMin: d.congeladaMinutos,
      congeladaMax: d.congeladaMinutos,
      derivadaMinutos: d.derivadaMinutos,
      ensanchan: d.difMinutos > 0 ? 1 : 0,
      angostan: d.difMinutos < 0 ? 1 : 0,
      baseHoy: d.baseHoy,
      muestras: d.muestras,
      proxima: d.serviceDate,
    });
  }
  /*
   * El que más lejos está de lo que hoy se vería, primero. Se mide contra la
   * congelada MÁS LEJANA del grupo, no contra una representante: ordenar por la
   * del primer servicio pondría arriba grupos tranquilos y abajo el que tiene
   * una ventana de 120 minutos donde hoy se derivan 75.
   */
  const distancia = (g: GrupoDeVentanas) =>
    Math.max(
      Math.abs(g.derivadaMinutos - g.congeladaMin),
      Math.abs(g.derivadaMinutos - g.congeladaMax),
    );
  return [...grupos.values()].sort((a, b) => distancia(b) - distancia(a));
}

export async function revisarVentanas(
  repos: Repositories,
): Promise<RevisionDeVentanas> {
  const filas = await repos.occurrences.sinSellarParaRevisionDeVentana();

  /*
   * La historia de duración TAL COMO ESTÁ HOY, y el largo del trazado para el
   * arranque en frío. Se leen una vez: preguntarlos por ocurrencia haría mil
   * consultas para las mismas cuarenta y siete rutas.
   */
  const medRaw = await repos.routes.todasLasDuraciones();
  const porRutaTurno = new Map<string, RouteDurationSample[]>();
  for (const m of medRaw) {
    const arr = porRutaTurno.get(m.routeShiftId) ?? [];
    arr.push({ durationMinutes: m.durationMinutes, lowerBound: m.lowerBound });
    porRutaTurno.set(m.routeShiftId, arr);
  }
  const largos = await repos.routes.largoDeTrazadoVigente();

  const desalineadas: VentanaDesalineada[] = [];

  for (const f of filas) {
    const policy = (f.policy ?? {}) as ContractPolicy;
    const muestras = porRutaTurno.get(f.routeShiftId) ?? [];
    /*
     * Se deriva con LA MISMA función que usa el generador, no con una copia.
     * Una segunda implementación aquí compararía la ventana contra una regla
     * que el motor no usa — verificar con el instrumento mal puesto.
     */
    const resumen = summarizeRouteDuration(muestras, {
      percentile: policy.routeDurationPercentile,
      minSamples: policy.routeDurationMinSamples,
    });
    const hoy = computeEvidenceWindow(f.expectedDeadline, policy, {
      measuredDurationMinutes: resumen.minutes,
      routeLengthKm: largos.get(f.routeId) ?? null,
    });

    const congeladaMinutos = Math.round(
      (f.expectedDeadline.getTime() - f.evidenceWindowStart.getTime()) / 60_000,
    );
    if (hoy.beforeMinutes === congeladaMinutos) continue;

    desalineadas.push({
      ocurrenciaId: f.id,
      contratoId: f.contractId,
      contratoNombre: f.contractName,
      clienteNombre: f.clientName,
      routeShiftId: f.routeShiftId,
      rutaNombre: f.routeName,
      turnoNombre: f.shiftName,
      serviceDate: f.serviceDate,
      congeladaMinutos,
      derivadaMinutos: hoy.beforeMinutes,
      difMinutos: hoy.beforeMinutes - congeladaMinutos,
      baseHoy: hoy.basis,
      muestras: resumen.sampleCount,
      ventanaHoy: { inicio: hoy.windowStart, fin: hoy.windowEnd },
    });
  }

  return { revisadas: filas.length, desalineadas };
}

/** Largo del trazado vigente por ruta — expuesto para poder probar la derivación. */
export { routeLengthKm };
