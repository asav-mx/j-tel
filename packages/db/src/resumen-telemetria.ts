/**
 * El día de una unidad, resumido — la parte que no toca la base.
 *
 * La consulta devuelve los **bloques observados** (tramos de puntos sin hueco
 * adentro). De ahí para arriba todo es aritmética exacta, y vive aquí para
 * poder probarse sin base de datos.
 *
 * Lo que la base calcula y lo que no, y por qué:
 *
 *   SÍ  — conteos, primer y último dato, kilómetros y huecos. Son reglas de
 *         tiempo y de distancia: dos implementaciones dan el mismo número.
 *   NO  — la partición entre "en movimiento" y "detenida". Esa regla (radio de
 *         quietud y duración mínima) es un barrido con anclas, no una función
 *         de ventana, y ya está implementada una vez. Traducirla a SQL sería
 *         tener dos versiones de la misma regla esperando a divergir. Quien
 *         necesite esa partición pide los puntos de la unidad —que con el
 *         índice por unidad son cientos, no decenas de miles— y la calcula con
 *         la implementación que ya existe.
 */

/** Tramo de puntos consecutivos sin ningún hueco adentro. */
export type BloqueObservado = {
  desde: Date;
  hasta: Date;
  puntos: number;
  kmAproximados: number;
  saltosDescartados: number;
};

/** El día de una unidad, ya resumido. Una fila por unidad y por ventana. */
export type ResumenUnidadDia = {
  unitId: string;
  /** Día civil que se pidió, tal como lo mandó quien llama. */
  fecha: string;
  /** La franja observada — puede ser menos de 24 h si se pidió así. */
  desde: Date;
  hasta: Date;
  puntos: number;
  /** Equipos GPS distintos que reportaron. Una unidad puede cambiar de aparato. */
  equipos: number;
  primerDato: Date | null;
  ultimoDato: Date | null;
  kmAproximados: number;
  saltosDescartados: number;
  huecos: number;
  huecoMayorMinutos: number | null;
  minutosSinDato: number;
  minutosObservados: number;
  bloques: BloqueObservado[];
};

/** Sin un punto por más de esto, no hay observación: es hueco. */
export const HUECO_MINUTOS_POR_DEFECTO = 10;
/** Velocidad implícita imposible para un camión: el tramo es salto del equipo. */
export const SALTO_KMH_POR_DEFECTO = 300;

const MS_POR_MINUTO = 60_000;

const minutosEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MS_POR_MINUTO;

export type HuecosDeVentana = {
  huecos: number;
  huecoMayorMinutos: number | null;
  minutosSinDato: number;
};

/**
 * Los huecos de una ventana, dados sus bloques observados.
 *
 * Cuentan los tres tipos y no solo los de en medio: el tramo entre el inicio de
 * la franja y el primer dato es un hueco, y el que va del último dato al cierre
 * también. Si la unidad no reportó entre las 05:00 y las 06:30, esa ausencia es
 * parte de la respuesta — esconderla haría ver una franja observada que nadie
 * observó.
 */
export function huecosDeVentana(
  ventana: { desde: Date; hasta: Date },
  bloques: Array<{ desde: Date; hasta: Date }>,
): HuecosDeVentana {
  const total = Math.max(0, minutosEntre(ventana.desde, ventana.hasta));

  if (bloques.length === 0) {
    return {
      huecos: total > 0 ? 1 : 0,
      huecoMayorMinutos: total > 0 ? total : null,
      minutosSinDato: total,
    };
  }

  const ordenados = [...bloques].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  const duraciones: number[] = [];

  const inicial = minutosEntre(ventana.desde, ordenados[0]!.desde);
  if (inicial > 0) duraciones.push(inicial);

  for (let i = 1; i < ordenados.length; i++) {
    const entre = minutosEntre(ordenados[i - 1]!.hasta, ordenados[i]!.desde);
    if (entre > 0) duraciones.push(entre);
  }

  const final = minutosEntre(ordenados[ordenados.length - 1]!.hasta, ventana.hasta);
  if (final > 0) duraciones.push(final);

  return {
    huecos: duraciones.length,
    huecoMayorMinutos: duraciones.length > 0 ? Math.max(...duraciones) : null,
    minutosSinDato: duraciones.reduce((t, m) => t + m, 0),
  };
}

/**
 * Arma el resumen de una unidad a partir de sus bloques.
 *
 * Los totales se suman de los bloques en vez de calcularse aparte en SQL: así
 * un resumen nunca puede contradecir a los tramos que dice resumir.
 */
export function resumirUnidadDia(entrada: {
  unitId: string;
  fecha: string;
  desde: Date;
  hasta: Date;
  equipos: number;
  bloques: BloqueObservado[];
}): ResumenUnidadDia {
  const bloques = [...entrada.bloques].sort(
    (a, b) => a.desde.getTime() - b.desde.getTime(),
  );
  const { huecos, huecoMayorMinutos, minutosSinDato } = huecosDeVentana(entrada, bloques);

  return {
    unitId: entrada.unitId,
    fecha: entrada.fecha,
    desde: entrada.desde,
    hasta: entrada.hasta,
    puntos: bloques.reduce((t, b) => t + b.puntos, 0),
    equipos: entrada.equipos,
    primerDato: bloques[0]?.desde ?? null,
    ultimoDato: bloques[bloques.length - 1]?.hasta ?? null,
    kmAproximados: bloques.reduce((t, b) => t + b.kmAproximados, 0),
    saltosDescartados: bloques.reduce((t, b) => t + b.saltosDescartados, 0),
    huecos,
    huecoMayorMinutos,
    minutosSinDato,
    minutosObservados: bloques.reduce((t, b) => t + minutosEntre(b.desde, b.hasta), 0),
    bloques,
  };
}
