/**
 * El ritmo prometido — dónde iría una unidad si la frecuencia se sostuviera
 * (Marco 9.2e, enmienda del 20 de septiembre de 2026).
 *
 * ## Lo que esta pieza NO puede hacer, y es la mitad de su razón de existir
 *
 * 9.2e prohíbe **repartir la referencia pareja sobre el corredor**: eso supone
 * velocidad uniforme, que nadie midió, y es completar lo que falta (Marco 1.E).
 * La tentación es grande porque es una división: «la vuelta dura 40 min, van
 * 10, pinta la referencia al 25 % del trazado». Ese 25 % es un invento — el
 * camión tarda distinto entre dos paradas del centro que entre dos de la
 * carretera, y la diferencia es justo lo que la torre existe para ver.
 *
 * ## De dónde sale entonces la posición
 *
 * De los **pasos ya medidos**. Cada paso por parada trae su hora, así que entre
 * dos paradas contiguas hay un tiempo de tránsito **medido**, no supuesto.
 * Encadenados en orden dan el perfil de la vuelta: cuántos minutos lleva un
 * camión real al llegar a cada parada. Una referencia que lleva T minutos de
 * vuelta se coloca **entre las dos paradas cuyos tiempos medidos la encierran**.
 *
 * Dentro de ese tramo —y sólo dentro— se interpola. No es lo mismo que el
 * reparto parejo que 9.2e prohíbe: aquello supone una velocidad para toda la
 * ruta; esto interpola entre **dos puntos medidos contiguos**, que es lo más
 * fino que la evidencia permite. Se nombra `fraccionDelTramo` para que nadie la
 * lea como una posición medida, y quien dibuja sabe entre qué dos paradas va.
 *
 * ## Si falta un tramo, no hay perfil
 *
 * Un solo tramo sin medir rompe la cadena: los acumulados de ahí en adelante
 * serían mentira, y una referencia colocada con ellos se vería igual de firme
 * que una buena. **El perfil es todo o nada** — sin él, el carril va vacío y lo
 * declara, que es literalmente lo que 9.2e manda.
 */

/** Los tiempos medidos de un tramo entre dos paradas contiguas, en minutos. */
export interface TramoMedido {
  deStopId: string;
  aStopId: string;
  /** Una muestra por cada vez que se midió ese tránsito. */
  minutos: number[];
}

export interface ParadaDelPerfil {
  stopId: string;
  /** Minutos medidos desde la primera parada del sentido hasta ésta. */
  minutosAcumulados: number;
}

export type PerfilDeLaVuelta =
  | {
      medido: true;
      paradas: ParadaDelPerfil[];
      /** Lo que dura la vuelta completa según lo medido. */
      vueltaMinutos: number;
    }
  | {
      medido: false;
      /**
       * `sin_tramos` — no hay un solo tránsito medido todavía.
       * `perfil_incompleto` — hay algunos y faltan otros; la cadena no cierra.
       */
      motivo: "sin_tramos" | "perfil_incompleto";
      /** Cuántos tramos del sentido siguen sin una sola medición. */
      tramosSinMedir: number;
    };

/**
 * La mediana, y no el promedio, a propósito: un solo tránsito con un camión
 * varado en un crucero arrastraría el promedio de todo el tramo, y el perfil
 * dejaría de parecerse a lo que pasa cualquier día. La mediana aguanta ese
 * atípico sin que haya que decidir a mano cuál tirar.
 */
export function medianaDeMinutos(muestras: number[]): number | null {
  if (muestras.length === 0) return null;
  const ordenadas = [...muestras].sort((a, b) => a - b);
  const medio = Math.floor(ordenadas.length / 2);
  return ordenadas.length % 2 === 1
    ? ordenadas[medio]!
    : (ordenadas[medio - 1]! + ordenadas[medio]!) / 2;
}

/**
 * Encadena los tramos medidos en el perfil de la vuelta.
 *
 * `paradasEnOrden` son las paradas vigentes de UN sentido, ya ordenadas. Los
 * tramos son los tránsitos medidos entre cada par contiguo; el último cierra la
 * vuelta (última parada → primera), porque una vuelta es un circuito y sin ese
 * tramo no se sabe cuánto dura.
 */
export function perfilDeLaVuelta(
  paradasEnOrden: string[],
  tramos: TramoMedido[],
): PerfilDeLaVuelta {
  if (paradasEnOrden.length < 2) {
    return { medido: false, motivo: "sin_tramos", tramosSinMedir: 0 };
  }

  const medidaDe = new Map<string, number>();
  for (const t of tramos) {
    const mediana = medianaDeMinutos(t.minutos);
    if (mediana !== null) medidaDe.set(`${t.deStopId}→${t.aStopId}`, mediana);
  }

  // Los pares contiguos, incluido el que cierra la vuelta.
  const pares: Array<[string, string]> = [];
  for (let i = 0; i < paradasEnOrden.length; i++) {
    pares.push([paradasEnOrden[i]!, paradasEnOrden[(i + 1) % paradasEnOrden.length]!]);
  }

  const faltantes = pares.filter(([a, b]) => !medidaDe.has(`${a}→${b}`)).length;
  if (faltantes > 0) {
    return {
      medido: false,
      motivo: faltantes === pares.length ? "sin_tramos" : "perfil_incompleto",
      tramosSinMedir: faltantes,
    };
  }

  const paradas: ParadaDelPerfil[] = [];
  let acumulado = 0;
  for (let i = 0; i < paradasEnOrden.length; i++) {
    paradas.push({ stopId: paradasEnOrden[i]!, minutosAcumulados: acumulado });
    acumulado += medidaDe.get(`${pares[i]![0]}→${pares[i]![1]}`)!;
  }
  return { medido: true, paradas, vueltaMinutos: acumulado };
}

/**
 * Una referencia del ritmo. **No es una unidad** (9.2e): vive en su propio
 * carril, no se cuenta como camión y no se mezcla con la traza. El tipo se
 * llama distinto para que no quepa en una lista de unidades por descuido.
 */
export interface ReferenciaDeRitmo {
  /** Cuántos minutos lleva de vuelta. */
  minutosEnLaVuelta: number;
  /** Las dos paradas MEDIDAS que la encierran. */
  entre: { deStopId: string; aStopId: string };
  /**
   * Qué parte del tramo lleva, de 0 a 1, **interpolada entre esos dos tiempos
   * medidos**. Se llama así, y no `posicion`, porque no es una posición medida:
   * es dónde caería si el tramo se recorriera parejo, y eso sólo se afirma
   * dentro de un tramo, nunca sobre el corredor entero (9.2e).
   */
  fraccionDelTramo: number;
}

/**
 * Dónde irían las referencias, ahora.
 *
 * La referencia número k salió de la primera parada `k · frecuencia` minutos
 * después de que abrió la franja, y lleva en el corredor lo que falte hasta
 * `ahora`. Las que ya completaron la vuelta salen de la lista: una referencia
 * que dio la vuelta entera ya no está en ningún lado del corredor, y dejarla
 * pegada al final sería un camión de mentira estacionado en la terminal.
 *
 * **La apertura de la franja es el ancla, y es lo único que puede serlo:** es
 * el único instante declarado del que se puede decir «aquí empieza a correr la
 * promesa». Anclar al reloj de pared, o al primer paso del día, sería escoger
 * un origen que nadie prometió.
 */
export function colocarRitmoPrometido(entrada: {
  perfil: Extract<PerfilDeLaVuelta, { medido: true }>;
  frequencyMinutes: number;
  minutosDesdeAperturaDeLaFranja: number;
}): ReferenciaDeRitmo[] {
  const { perfil, frequencyMinutes, minutosDesdeAperturaDeLaFranja: transcurridos } = entrada;
  if (frequencyMinutes <= 0 || transcurridos < 0) return [];

  const referencias: ReferenciaDeRitmo[] = [];
  const ultima = Math.floor(transcurridos / frequencyMinutes);

  for (let k = 0; k <= ultima; k++) {
    const minutosEnLaVuelta = transcurridos - k * frequencyMinutes;
    if (minutosEnLaVuelta >= perfil.vueltaMinutos) continue; // ya dio la vuelta

    // El tramo que la encierra: la última parada cuyo acumulado no la rebasa.
    let i = 0;
    for (let j = 0; j < perfil.paradas.length; j++) {
      if (perfil.paradas[j]!.minutosAcumulados <= minutosEnLaVuelta) i = j;
    }
    const desde = perfil.paradas[i]!;
    const siguiente = perfil.paradas[i + 1];
    const finDelTramo = siguiente ? siguiente.minutosAcumulados : perfil.vueltaMinutos;
    const largoDelTramo = finDelTramo - desde.minutosAcumulados;

    referencias.push({
      minutosEnLaVuelta,
      entre: {
        deStopId: desde.stopId,
        // Sin siguiente, el tramo es el que cierra la vuelta: vuelve a la primera.
        aStopId: (siguiente ?? perfil.paradas[0]!).stopId,
      },
      fraccionDelTramo:
        largoDelTramo > 0 ? (minutosEnLaVuelta - desde.minutosAcumulados) / largoDelTramo : 0,
    });
  }
  return referencias;
}
