/**
 * La política, medida contra la operación real — funciones puras.
 *
 * Un número de configuración no dice nada solo. "Umbral 60%" no le sirve a
 * nadie; "umbral 60%, tu operación vive en 94.2%" le dice al usuario que tiene
 * margen. Y al revés: "hora límite 17:45, tus llegadas ocurren a las 13:47" le
 * dice que la hora declarada no es la hora a la que opera — que es exactamente
 * el error que envenenó 300 veredictos sin que nada se viera roto.
 *
 * De ahí que esta pantalla no sea un formulario: es un formulario con la
 * operación medida al lado de cada perilla.
 *
 * Todo lo que se lee aquí sale de hechos YA sellados. Leerlos no verifica nada
 * de nuevo: la ley 2 sigue intacta, esto solo mira lo que ya se decidió.
 *
 * Sin base de datos: la página reúne, esto mide.
 */

/** Un hecho sellado, reducido a lo que la lectura necesita. */
export type HechoParaLectura = {
  estado: "cumplido" | "no_cumplido" | "pendiente_evidencia";
  /** Cuándo se le exigió estar. */
  deadline: Date;
  /** Cuándo llegó, si el árbitro llegó a observar una llegada. */
  llegada: Date | null;
  /** Cobertura del trazado contratado, si se midió. */
  coberturaRutaPct: number | null;
  /** Motivo excusable invocado, si hubo. */
  motivoExcusable: string | null;
};

export type Distribucion = {
  /** Cuántos hechos la sostienen. Una distribución de 2 no es una distribución. */
  n: number;
  mediana: number;
  minimo: number;
  maximo: number;
};

/**
 * Mediana y no promedio: un solo caso extremo mueve el promedio y haría ver
 * torcida una operación que es regular casi siempre.
 */
export function distribucion(valores: number[]): Distribucion | null {
  if (valores.length === 0) return null;
  const orden = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(orden.length / 2);
  const mediana =
    orden.length % 2 === 0 ? (orden[medio - 1]! + orden[medio]!) / 2 : orden[medio]!;
  return {
    n: orden.length,
    mediana,
    minimo: orden[0]!,
    maximo: orden[orden.length - 1]!,
  };
}

/**
 * Debajo de esto una distribución no se muestra como tal.
 *
 * Con tres servicios se puede calcular una mediana, pero enseñarla al lado de
 * un umbral invita a mover el umbral por ruido. La pantalla dice cuántos
 * hechos hay y se calla si son pocos.
 */
export const MINIMO_PARA_LEER = 8;

export type LecturaDeUmbral = {
  distribucion: Distribucion;
  umbral: number;
  /** Distancia de la mediana al umbral, en puntos. Negativa: está debajo. */
  margenMediana: number;
  /** Cuántos hechos quedaron a menos de `cerca` puntos del umbral, o debajo. */
  alFilo: number;
  /** Cuántos quedaron directamente debajo del umbral. */
  debajo: number;
  holgura: "amplia" | "justa" | "invertida";
};

/**
 * Dónde vive la operación respecto a un umbral.
 *
 * `holgura` es la lectura que el usuario necesita antes de tocar el número:
 *
 *   amplia     — la operación entera está cómodamente del lado bueno
 *   justa      — el rango real toca el umbral; moverlo cambia resultados
 *   invertida  — la mediana está del lado malo: el umbral no describe esta
 *                operación, y quien lo puso probablemente se equivocó
 */
export function lecturaDeUmbral(
  valores: number[],
  umbral: number,
  cerca = 2,
): LecturaDeUmbral | null {
  const dist = distribucion(valores);
  if (!dist) return null;

  const debajo = valores.filter((v) => v < umbral).length;
  const alFilo = valores.filter((v) => v < umbral + cerca).length;
  const margenMediana = dist.mediana - umbral;

  const holgura: LecturaDeUmbral["holgura"] =
    margenMediana < 0 ? "invertida" : dist.minimo < umbral + cerca ? "justa" : "amplia";

  return { distribucion: dist, umbral, margenMediana, alFilo, debajo, holgura };
}

/** Minutos entre la llegada y la hora límite. Negativo: llegó antes. */
export function margenEnMinutos(hecho: HechoParaLectura): number | null {
  if (!hecho.llegada) return null;
  return (hecho.llegada.getTime() - hecho.deadline.getTime()) / 60_000;
}

export type SospechaDeVentana =
  | { hay: false }
  | {
      hay: true;
      clase: "llegadas_lejos" | "sin_llegadas";
      /** Los números exactos que sostienen la sospecha. */
      medidos: {
        total: number;
        conLlegada: number;
        sinLlegada: number;
        medianaMargenMin: number | null;
        ventanaAbreMin: number;
        ventanaCierraMin: number;
      };
    };

/**
 * ¿La ventana configurada está mirando donde de verdad ocurre la operación?
 *
 * Esta es la defensa contra el error que no se ve: un turno declarado a una
 * hora que no es la hora a la que se opera. El deadline sale de la hora del
 * turno, la ventana sale del deadline, y si la hora está mal la ventana mira
 * un rato en el que no pasa nada. El resultado no falla con un error: falla
 * con trescientos veredictos perfectamente sellados y perfectamente falsos.
 *
 * Se buscan dos huellas distintas:
 *
 *   sin_llegadas    — casi ningún servicio llegó a tener una llegada
 *                     observada. O la operación pasa fuera de la ventana, o
 *                     las unidades no reportan.
 *   llegadas_lejos  — sí hay llegadas, pero su mediana cae fuera de la
 *                     ventana o pegada a un borde.
 *
 * NO dictamina cuál de las dos causas es. Declara lo medido y lo que no
 * responde; decidir es del humano que conoce la operación.
 */
export function sospechaDeVentana(
  hechos: HechoParaLectura[],
  ventana: { abreMinAntes: number; cierraMinDespues: number },
): SospechaDeVentana {
  if (hechos.length < MINIMO_PARA_LEER) return { hay: false };

  const conLlegada = hechos.filter((h) => h.llegada !== null);
  const sinLlegada = hechos.length - conLlegada.length;
  const margenes = conLlegada
    .map(margenEnMinutos)
    .filter((m): m is number => m !== null);
  const dist = distribucion(margenes);

  const medidos = {
    total: hechos.length,
    conLlegada: conLlegada.length,
    sinLlegada,
    medianaMargenMin: dist?.mediana ?? null,
    ventanaAbreMin: ventana.abreMinAntes,
    ventanaCierraMin: ventana.cierraMinDespues,
  };

  // Más de la mitad de los servicios resueltos sin ver una sola llegada es
  // anómalo en una operación que de verdad ocurre dentro de la ventana.
  if (conLlegada.length / hechos.length < 0.5) {
    return { hay: true, clase: "sin_llegadas", medidos };
  }

  if (dist) {
    const fueraPorAbajo = dist.mediana < -ventana.abreMinAntes;
    const fueraPorArriba = dist.mediana > ventana.cierraMinDespues;
    if (fueraPorAbajo || fueraPorArriba) {
      return { hay: true, clase: "llegadas_lejos", medidos };
    }
  }

  return { hay: false };
}

export type UsoDeMotivo = { motivo: string; usos: number };

/** Cuántas veces se invocó cada motivo. Los de cero también aparecen. */
export function usosDeMotivos(
  hechos: HechoParaLectura[],
  habilitados: string[],
): UsoDeMotivo[] {
  const cuenta = new Map<string, number>();
  for (const m of habilitados) cuenta.set(m, 0);
  for (const h of hechos) {
    if (!h.motivoExcusable) continue;
    cuenta.set(h.motivoExcusable, (cuenta.get(h.motivoExcusable) ?? 0) + 1);
  }
  return [...cuenta.entries()].map(([motivo, usos]) => ({ motivo, usos }));
}

export type ResumenDeResultados = {
  total: number;
  cumplido: number;
  no_cumplido: number;
  pendiente_evidencia: number;
};

export function resumirResultados(hechos: HechoParaLectura[]): ResumenDeResultados {
  return {
    total: hechos.length,
    cumplido: hechos.filter((h) => h.estado === "cumplido").length,
    no_cumplido: hechos.filter((h) => h.estado === "no_cumplido").length,
    pendiente_evidencia: hechos.filter((h) => h.estado === "pendiente_evidencia").length,
  };
}
