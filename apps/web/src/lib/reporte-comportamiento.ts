import {
  intervaloMedianoMinutos,
  intervalosEntrePasadas,
  pasadasPorElPunto,
  serieSobreTrazado,
  vueltasSobreLaSerie,
  type PuntoDelDia,
  type SerieDelDia,
  type Sentido,
  type TrazadoParaMedir,
} from "@jtel/domain";

/**
 * El reporte de comportamiento de un circuito: **lo que se observó hoy.**
 *
 * Toda la aritmética vive aquí y no dentro del `.tsx`, por la razón de siempre:
 * una cifra escrita dentro de un componente no se puede probar sin montar la
 * pantalla.
 *
 * ## Lo que este archivo NO hace
 *
 * **No juzga.** No hay «cumplió», no hay «va atrasada», no hay calificación de
 * nadie. En concesionado el motor mide y reporta, y el Tramo JB lo dice sin
 * ambigüedad: la plataforma los MUESTRA, no los vigila. Un renglón de este
 * reporte pone una medición y su hueco; qué significa lo decide el operador.
 *
 * **No estima tiempos.** Los minutos que salen de aquí son diferencias entre dos
 * horas reales —cuándo arrancó una vuelta y cuándo la cerró, cuánto hubo entre
 * dos pasadas—. Ninguno sale de dividir distancia entre velocidad, así que el
 * interruptor del rango no tiene por dónde entrar.
 *
 * **No afirma sobre el día completo.** Afirma hasta el último punto archivado, y
 * eso viaja en el reporte para que la pantalla lo diga.
 */

/** Dónde se mide el intervalo entre camiones, en fracción del trazado.
 *
 * A la mitad y no en una punta: en las terminales las unidades arrancan, se
 * detienen y maniobran, y ahí un cruce no significa «va pasando por la ruta».
 * Es declarado y es parámetro, como los demás umbrales de este frente. */
export const PUNTO_DE_CONTROL = 0.5;

export interface UnidadDelHistorial {
  unitId: string;
  unitLabel: string;
  puntos: PuntoDelDia[];
}

export interface VueltasPorSentido {
  sentido: Sentido;
  vueltas: number;
  enCurso: boolean;
  /** Mediana de lo que tardó cada vuelta. `null` con menos de una. */
  minutosMediana: number | null;
}

export interface ReporteDeUnidad {
  unitId: string;
  unitLabel: string;
  /** Cuántos puntos del archivo se leyeron de esta unidad. */
  puntos: number;
  /**
   * Cuántos cayeron fuera del corredor. **Se enuncia**: un reporte que descarta
   * puntos y no lo dice afirma sobre el día lo que sólo vale para lo que miró.
   */
  fueraDelCorredor: number;
  primeraSenal: Date | null;
  ultimaSenal: Date | null;
  porSentido: VueltasPorSentido[];
}

export interface ReporteDelDia {
  desde: Date;
  hasta: Date;
  /**
   * Hasta qué instante llega el archivo. **No es la hora del reloj**, y por eso
   * va aparte: el archivador mete su propio retraso, así que «las vueltas de
   * hoy» siempre significa «hasta aquí». `null` cuando no hay un solo punto.
   */
  corteDelArchivo: Date | null;
  unidades: ReporteDeUnidad[];
  /** Cuántas se leyeron y cuántas hay en el plan: el numerador y su denominador. */
  conSenal: number;
  enElPlan: number;
  /**
   * El intervalo observado entre camiones en el punto de control. `null` con
   * menos de dos pasadas: con un solo camión no hay intervalo, y un cero ahí
   * diría que pasan pegados.
   */
  intervaloMedianoMin: number | null;
  intervalosMedidos: number;
  /**
   * La frecuencia que el concesionario declaró, o `null`.
   *
   * **Cuando es `null` no hay contra qué comparar, y la pantalla lo dice en vez
   * de escoger un número.** Es exactamente lo que la `0031` vino a arreglar: el
   * `DEFAULT 20` hacía indistinguibles «declaró 20» y «no declaró nada», y la
   * app afirmaba la cadencia igual en los dos casos. Un reporte que dijera «va
   * atrasada» contra una frecuencia que nadie declaró es la misma falta, del
   * lado del concesionario en vez del pasajero.
   */
  frecuenciaDeclaradaMin: number | null;
  /** Sin trazado no hay contra qué proyectar: no se mide nada y se dice. */
  sinTrazado: boolean;
}

export function armarReporte(entrada: {
  desde: Date;
  hasta: Date;
  corteDelArchivo: Date | null;
  trazados: TrazadoParaMedir[];
  corredorMetros: number;
  frecuenciaDeclaradaMin: number | null;
  /** Todas las del plan, incluidas las que no tienen un solo punto. */
  historial: UnidadDelHistorial[];
}): ReporteDelDia {
  const { desde, hasta, corteDelArchivo, trazados, corredorMetros, historial } = entrada;

  const sinTrazado = trazados.length === 0;

  /* Las series, una por unidad y sentido. Se calculan una vez: las vueltas y el
     intervalo leen las mismas, para que no puedan decir cosas distintas del
     mismo camión. */
  const seriesPorUnidad = new Map<string, Array<{ sentido: Sentido; serie: SerieDelDia }>>();

  for (const u of historial) {
    seriesPorUnidad.set(
      u.unitId,
      trazados.map((t) => ({
        sentido: t.sentido,
        serie: serieSobreTrazado(u.puntos, t, corredorMetros),
      })),
    );
  }

  const unidades: ReporteDeUnidad[] = historial.map((u) => {
    const series = seriesPorUnidad.get(u.unitId) ?? [];
    const horas = u.puntos.map((p) => p.recordedAt.getTime());

    return {
      unitId: u.unitId,
      unitLabel: u.unitLabel,
      puntos: u.puntos.length,
      /*
       * Lo de fuera se cuenta UNA vez, no una por sentido: el mismo punto cae
       * fuera de la ida y de la vuelta, y sumarlos lo contaría doble. Se toma el
       * menor, que es «fuera de TODOS los trazados».
       */
      fueraDelCorredor:
        series.length === 0
          ? 0
          : Math.min(...series.map((s) => s.serie.fueraDelCorredor)),
      primeraSenal: horas.length ? new Date(Math.min(...horas)) : null,
      ultimaSenal: horas.length ? new Date(Math.max(...horas)) : null,
      porSentido: series.map(({ sentido, serie }) => {
        const v = vueltasSobreLaSerie(serie);
        const minutos = v.vueltas.map((x) => x.minutos).sort((a, b) => a - b);
        const medio = Math.floor(minutos.length / 2);
        return {
          sentido,
          vueltas: v.vueltas.length,
          enCurso: v.enCurso,
          minutosMediana:
            minutos.length === 0
              ? null
              : minutos.length % 2 === 0
                ? (minutos[medio - 1] + minutos[medio]) / 2
                : minutos[medio],
        };
      }),
    };
  });

  /*
   * El intervalo se mide sobre el PRIMER trazado y no sobre los dos juntos.
   *
   * Mezclar ida y vuelta en una sola cuenta produciría intervalos de camiones
   * que van en direcciones contrarias, y a quien está parado en una esquina no
   * le sirve saber que pasó uno del otro lado de la calle. Con un solo sentido
   * cargado se mide ése, que es el caso de hoy.
   */
  const primerSentido = trazados[0]?.sentido ?? null;
  const paraElIntervalo =
    primerSentido === null
      ? []
      : historial
          .map((u) => ({
            unidad: u.unitLabel,
            serie: (seriesPorUnidad.get(u.unitId) ?? []).find(
              (s) => s.sentido === primerSentido,
            )?.serie,
          }))
          .filter((x): x is { unidad: string; serie: SerieDelDia } => x.serie !== undefined);

  const intervalos = intervalosEntrePasadas(
    pasadasPorElPunto(paraElIntervalo, PUNTO_DE_CONTROL),
  );

  return {
    desde,
    hasta,
    corteDelArchivo,
    unidades,
    conSenal: unidades.filter((u) => u.puntos > 0).length,
    enElPlan: unidades.length,
    intervaloMedianoMin: intervaloMedianoMinutos(intervalos),
    intervalosMedidos: intervalos.length,
    frecuenciaDeclaradaMin: entrada.frecuenciaDeclaradaMin,
    sinTrazado,
  };
}

/**
 * Agrupa las filas planas de la consulta en el historial por unidad.
 *
 * **Las unidades del plan sin un solo punto se conservan**, con su lista vacía.
 * La consulta las pierde —une contra `telemetry_points`, así que una unidad sin
 * archivo no produce filas—, y desaparecida se lee como que no está asignada.
 * Ese renglón es justo el que el operador necesita ver.
 */
export function agruparHistorial(
  filas: Array<{ unitId: string; unitLabel: string; latitude: number; longitude: number; recordedAt: Date }>,
  plan: Array<{ unitId: string; unitLabel: string }>,
): UnidadDelHistorial[] {
  const porUnidad = new Map<string, UnidadDelHistorial>();

  for (const u of plan) {
    porUnidad.set(u.unitId, { unitId: u.unitId, unitLabel: u.unitLabel, puntos: [] });
  }

  for (const f of filas) {
    let u = porUnidad.get(f.unitId);
    if (!u) {
      u = { unitId: f.unitId, unitLabel: f.unitLabel, puntos: [] };
      porUnidad.set(f.unitId, u);
    }
    u.puntos.push({ lat: f.latitude, lon: f.longitude, recordedAt: f.recordedAt });
  }

  return [...porUnidad.values()].sort((a, b) => a.unitLabel.localeCompare(b.unitLabel, "es"));
}
