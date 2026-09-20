/**
 * El detector de pasos por parada (Marco 9.2 / 9.11) — eslabón 2 de la
 * cadena del arranque.
 *
 * **Detección por cruce sobre el trazado** (decisión A de Asav, 19-sep):
 * la unidad se proyecta sobre el trazado con la MISMA geometría
 * punto-a-segmento que ya usa el pegado de paradas (`proyectarSobreTrazado`,
 * en `trazado.ts`); la parada tiene su propia abscisa sobre ese mismo
 * trazado; hay paso cuando la proyección cruza esa abscisa entre dos puntos
 * consecutivos.
 *
 * **Por qué no el radio.** Medido el 19-sep: los FTC927 dan 15–61 m entre
 * puntos con el camión andando —mucho más fino que los 440–810 m de la flota
 * vieja—, pero los HUECOS siguen ahí (hasta 75 h en un aparato en una
 * semana), y el hueco es justo donde está la parada: es donde el camión se
 * detiene. Un detector de radio se salta la parada cuando el hueco se traga
 * el tramo; el cruce no, porque ocurre entre los dos puntos que encierran el
 * hueco — lo único que se ensancha es el rango de la hora.
 *
 * **El paso es un rango, no un instante** (decisión C): `pasoDesde` y
 * `pasoHasta` son los dos pings que encierran el cruce. No hay «la hora del
 * paso» — el instrumento no la conoce, y fingir que sí es la afirmación
 * falsa que el Marco §D prohíbe.
 *
 * **Fuera del corredor no hay paso** (decisión B, recomendación de la
 * ficha): un camión desviado no está pasando por sus paradas. El tramo queda
 * como hueco — dicho, no un cero callado.
 */

import { proyectarSobreTrazado } from "./trazado.js";

export interface PuntoDeTelemetria {
  /** El id real del punto, para guardar como evidencia (decisión C). */
  id: string;
  lat: number;
  lon: number;
  recordedAt: Date;
}

export interface ParadaParaDetectar {
  stopId: string;
  /** La versión de la parada vigente cuando se detecta — decisión F. */
  stopVersionId: string;
  lat: number;
  lon: number;
}

export interface PasoDetectado {
  stopId: string;
  stopVersionId: string;
  /** El ping de antes del cruce. */
  pasoDesde: Date;
  /** El ping de después. */
  pasoHasta: Date;
  huecoSegundos: number;
  pingPrevioId: string;
  pingSiguienteId: string;
}

/**
 * Detecta los cruces de un recorrido de puntos consecutivos sobre las
 * paradas de un trazado, en UN sentido.
 *
 * `puntos` debe venir ordenado por `recordedAt` ascendente, y todos del
 * MISMO trazado de UN sentido — cada sentido tiene su propio trazado
 * (`circuit_paths`), así que esta función se llama una vez por sentido.
 *
 * Cada parada se proyecta sobre el trazado UNA vez (su abscisa, en metros
 * desde el inicio) y se compara contra el avance de cada intervalo. No
 * cuenta retroceso: si el avance no crece entre dos puntos, ningún cruce de
 * ese intervalo se considera real — un camión detenido o que se mueve hacia
 * atrás en la proyección no está sirviendo la ruta hacia adelante.
 */
export function detectarPasosEnRecorrido(
  puntos: PuntoDeTelemetria[],
  trazado: Array<[number, number]>,
  paradas: ParadaParaDetectar[],
  corridorToleranceMeters: number,
): PasoDetectado[] {
  const pasos: PasoDetectado[] = [];
  if (puntos.length < 2 || trazado.length < 2 || paradas.length === 0) return pasos;

  const abscisas = paradas.map((p) => {
    const proyeccion = proyectarSobreTrazado({ lat: p.lat, lon: p.lon }, trazado);
    return { parada: p, avanceMetros: proyeccion?.avanceMetros ?? null };
  });

  const proyecciones = puntos.map((p) => proyectarSobreTrazado({ lat: p.lat, lon: p.lon }, trazado));

  for (let i = 0; i < puntos.length - 1; i++) {
    const p1 = proyecciones[i];
    const p2 = proyecciones[i + 1];
    if (!p1 || !p2) continue;

    // Decisión B: fuera del corredor no genera pasos. El tramo se queda como
    // hueco — no se afirma nada de él, ni cumplimiento ni falta.
    if (p1.distanciaMetros > corridorToleranceMeters || p2.distanciaMetros > corridorToleranceMeters) {
      continue;
    }

    if (p2.avanceMetros <= p1.avanceMetros) continue; // sin avance, sin cruce.

    for (const { parada, avanceMetros } of abscisas) {
      if (avanceMetros === null) continue; // la parada no proyecta sobre este trazado.
      // (p1, p2]: estrictamente después del punto anterior, hasta el
      // siguiente inclusive — para no contar la misma parada dos veces si
      // cae justo en la frontera de dos intervalos consecutivos.
      if (avanceMetros > p1.avanceMetros && avanceMetros <= p2.avanceMetros) {
        pasos.push({
          stopId: parada.stopId,
          stopVersionId: parada.stopVersionId,
          pasoDesde: puntos[i]!.recordedAt,
          pasoHasta: puntos[i + 1]!.recordedAt,
          huecoSegundos: Math.round(
            (puntos[i + 1]!.recordedAt.getTime() - puntos[i]!.recordedAt.getTime()) / 1000,
          ),
          pingPrevioId: puntos[i]!.id,
          pingSiguienteId: puntos[i + 1]!.id,
        });
      }
    }
  }

  return pasos;
}

// ── Banda contra banda: el paso contra la promesa (decisión C, tercera parte) ──

export type VeredictoDePaso = "sostuvo" | "se_agujero" | "sin_datos";

export interface VentanaEsperada {
  /** El instante donde se esperaba el paso: ancla + frecuencia. */
  centro: Date;
  desde: Date;
  hasta: Date;
}

/**
 * La ventana en la que se esperaba el paso.
 *
 * **Anclada al paso ANTERIOR, no a la hora del reloj** (decisión de Asav,
 * 20-sep): lo que importa es cuánto esperó el pasajero, no en qué hora del
 * día llegó el camión. `ancla` es el fin del rango del paso anterior en la
 * MISMA parada y el mismo sentido — o, si es el primero del día, la apertura
 * declarada del circuito (ver `compararPaso`).
 *
 * **La tolerancia es PORCENTAJE de la frecuencia, no segundos fijos**: 2 min
 * sobre «cada 10» es el 20 %; sobre «cada 30» no es nada. `toleranciaPct` es
 * 0–100 (`50` = ±50 %). Nace ancha a propósito: la primera medición es de un
 * servicio nuevo, y una banda estrecha desde el día uno pintaría todo rojo
 * sin que el servicio hubiera fallado.
 */
export function ventanaEsperada(
  ancla: Date,
  frequencyMinutes: number,
  toleranciaPct: number,
): VentanaEsperada {
  const centro = new Date(ancla.getTime() + frequencyMinutes * 60_000);
  const toleranciaMs = frequencyMinutes * 60_000 * (toleranciaPct / 100);
  return {
    centro,
    desde: new Date(centro.getTime() - toleranciaMs),
    hasta: new Date(centro.getTime() + toleranciaMs),
  };
}

/**
 * Compara el RANGO del paso —no un instante— contra la ventana esperada.
 *
 * Banda contra banda (decisión C, Asav 19-sep): el rango cabe DENTRO →
 * `sostuvo`; cae ENTERO fuera → `se_agujero`; se TRASLAPA con la orilla →
 * `sin_datos`, nunca un veredicto a medias.
 *
 * **Temprano y tarde dan la MISMA etiqueta** (`se_agujero`) cuando caen
 * enteros fuera — es 9.1b: el adelanto daña igual que el atraso. Esta
 * función no distingue de qué lado se salió; sólo dice si se salió.
 */
export function compararRangoContraVentana(
  paso: { pasoDesde: Date; pasoHasta: Date },
  ventana: VentanaEsperada,
): VeredictoDePaso {
  const pDesde = paso.pasoDesde.getTime();
  const pHasta = paso.pasoHasta.getTime();
  const vDesde = ventana.desde.getTime();
  const vHasta = ventana.hasta.getTime();

  if (pDesde >= vDesde && pHasta <= vHasta) return "sostuvo";
  if (pHasta < vDesde || pDesde > vHasta) return "se_agujero";
  return "sin_datos";
}

export interface InsumoDeComparacion {
  /**
   * El fin del rango del paso anterior en la misma parada y sentido, **del
   * mismo día civil** — o `null` cuando este paso es el primero del día
   * (decisión de Asav: el primero no tiene paso anterior, se compara contra
   * la apertura).
   */
  pasoAnteriorHasta: Date | null;
  /**
   * La apertura declarada del circuito, como instante real de ESTE día civil
   * — sólo se usa cuando `pasoAnteriorHasta` es `null`. Quien llama la
   * construye (necesita la zona del circuito, fuera del alcance de este
   * módulo puro).
   */
  aperturaDeclarada: Date | null;
  /**
   * La promesa vigente **en el instante de este paso** (decisión D: contra
   * la franja vigente en el instante del paso, no contra la de hoy). `null`
   * si no hay promesa declarada para ese instante.
   */
  frequencyMinutes: number | null;
  /** `circuits.arrival_tolerance_pct` — por circuito, nunca escondida. */
  toleranciaPct: number;
}

/**
 * El veredicto de UN paso, con la regla del «no inventes» de Asav aplicada
 * en el único lugar donde puede aplicarse: si no hay ancla (ni paso anterior
 * ni apertura) o no hay promesa vigente para ese instante, **no se calcula
 * nada — es `sin_datos`**, nunca una ventana inventada con un valor por
 * omisión.
 */
export function compararPaso(
  paso: { pasoDesde: Date; pasoHasta: Date },
  insumo: InsumoDeComparacion,
): VeredictoDePaso {
  const ancla = insumo.pasoAnteriorHasta ?? insumo.aperturaDeclarada;
  if (!ancla || insumo.frequencyMinutes === null) return "sin_datos";
  return compararRangoContraVentana(paso, ventanaEsperada(ancla, insumo.frequencyMinutes, insumo.toleranciaPct));
}
