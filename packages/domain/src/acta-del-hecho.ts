import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";

/**
 * **El acta de un hecho sellado, congelada dentro del hecho** — C24, Tramo 4.
 *
 * ## Qué problema cierra
 *
 * El expediente de un hecho explica un veredicto leyendo filas que alguien
 * puede editar: la ventana del viaje, la etiqueta y las placas de la unidad,
 * los nombres del perfil, el contrato y la planta. Nada de eso viaja dentro
 * del hecho, así que **un cambio ahí es indetectable por construcción** — no
 * es que se detecte tarde: es que no queda rastro de que hubo un antes.
 *
 * La mitad barata de C24 ya está en `main` desde el 12-ago (#291): el
 * expediente lee `contractPolicySnapshot` y no la política viva. Esto es la
 * otra mitad, la que el diagnóstico llamó «lo peor, y no tiene cifra».
 *
 * ## Texto plano, no referencias
 *
 * Los nombres y las placas van como **texto**, igual que `declaredDriverName`
 * y por la misma razón: una referencia a una fila que alguien puede editar o
 * purgar deja el acta con un hueco. El acta de un servicio tiene que
 * sobrevivir al borrado del chofer, al renombre de la unidad y al cambio de
 * nombre de la planta.
 *
 * ## El contorno de la evidencia, y por qué no se copian los puntos
 *
 * Copiar los puntos multiplicaría la base por algo que ya vive en su tabla:
 * son miles por viaje. Pero **guardar nada era peor**, y ésa fue la corrección
 * de Asav: sin algo congelado enfrente, la divergencia es invisible. Así que
 * el acta guarda el **contorno** — cuántos puntos, de cuándo a cuándo, y una
 * huella que cambia si cambian — y con eso el expediente puede **decir «esto
 * ya no cuadra»** en vez de callarse.
 *
 * La huella no permite reconstruir nada: no es una copia, es un testigo.
 */

/** Una unidad, como se llamaba el día del sello. */
export interface UnidadEnElActa {
  /** El número económico — el que trae pintado el camión. */
  readonly economico: string;
  /** Las placas, si las tenía capturadas. `null` es un hueco legítimo. */
  readonly placas: string | null;
}

/** El contorno de la evidencia con la que se juzgó. Ver arriba. */
export interface ContornoDeEvidencia {
  readonly puntos: number;
  /** El primero y el último punto que entraron al juicio. `null` si no hubo. */
  readonly desde: string | null;
  readonly hasta: string | null;
  /**
   * Huella de los puntos. Cambia si cambia cualquiera: su instante, su lugar,
   * su orden, o cuántos son.
   */
  readonly huella: string;
}

/**
 * El acta. **Las familias van como llaves de un solo `jsonb`** y no como
 * cuatro columnas (decisión de Asav, 23-sep-2026): cuatro columnas invitan a
 * que un día se llenen tres, y estas familias ya crecieron una vez.
 */
export interface ActaDelHecho {
  /** La ventana de evidencia del viaje, tal como se abrió y se cerró. */
  readonly ventana: { readonly desde: string | null; readonly hasta: string | null };
  readonly unidades: {
    readonly observada: UnidadEnElActa | null;
    readonly referencia: UnidadEnElActa | null;
  };
  readonly nombres: {
    readonly perfil: string | null;
    readonly contrato: string | null;
    readonly planta: string | null;
    readonly cliente: string | null;
    readonly transportista: string | null;
  };
  readonly viaje: { readonly estado: string | null };
  readonly evidencia: ContornoDeEvidencia;
}

/** Un punto, con lo único que la huella mira. */
export interface PuntoParaLaHuella {
  readonly recordedAt: Date | string;
  readonly latitude: number;
  readonly longitude: number;
}

const instante = (d: Date | string | null | undefined): string | null =>
  d === null || d === undefined ? null : new Date(d).toISOString();

/**
 * La huella del contorno.
 *
 * **Se ordena antes de resumir**, porque el orden en que la base devuelva los
 * puntos no es una propiedad de la evidencia: dos lecturas de los mismos
 * puntos tienen que dar la misma huella, o la alarma sonaría sola.
 *
 * Las coordenadas se fijan a seis decimales — ~11 cm, muy por debajo de lo que
 * un GPS de camión distingue. Sin fijarlas, la misma latitud escrita como
 * `31.74` y `31.740000000000002` daría huellas distintas, y el expediente
 * gritaría por un redondeo del punto flotante.
 */
export function huellaDeLaEvidencia(puntos: readonly PuntoParaLaHuella[]): string {
  const filas = puntos
    .map((p) => {
      const t = new Date(p.recordedAt).toISOString();
      return `${t}|${p.latitude.toFixed(6)}|${p.longitude.toFixed(6)}`;
    })
    .sort();
  return `sha256:${bytesToHex(sha256(utf8ToBytes(filas.join("\n")))).slice(0, 32)}`;
}

/** Arma el acta. Puro: lo que entra es lo que el motor ya tenía en la mano. */
export function armarActaDelHecho(entrada: {
  ventana: { desde: Date | string | null; hasta: Date | string | null };
  unidadObservada: UnidadEnElActa | null;
  unidadDeReferencia: UnidadEnElActa | null;
  nombres: {
    perfil?: string | null;
    contrato?: string | null;
    planta?: string | null;
    cliente?: string | null;
    transportista?: string | null;
  };
  estadoDelViaje: string | null;
  puntos: readonly PuntoParaLaHuella[];
}): ActaDelHecho {
  const instantes = entrada.puntos
    .map((p) => new Date(p.recordedAt).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  return {
    ventana: { desde: instante(entrada.ventana.desde), hasta: instante(entrada.ventana.hasta) },
    unidades: {
      observada: entrada.unidadObservada,
      referencia: entrada.unidadDeReferencia,
    },
    nombres: {
      perfil: entrada.nombres.perfil ?? null,
      contrato: entrada.nombres.contrato ?? null,
      planta: entrada.nombres.planta ?? null,
      cliente: entrada.nombres.cliente ?? null,
      transportista: entrada.nombres.transportista ?? null,
    },
    viaje: { estado: entrada.estadoDelViaje },
    evidencia: {
      puntos: entrada.puntos.length,
      desde: instantes.length ? new Date(instantes[0]!).toISOString() : null,
      hasta: instantes.length ? new Date(instantes[instantes.length - 1]!).toISOString() : null,
      huella: huellaDeLaEvidencia(entrada.puntos),
    },
  };
}

export type CotejoDelContorno =
  | { readonly que: "sin_acta" }
  | { readonly que: "cuadra" }
  | { readonly que: "no_cuadra"; readonly motivo: string };

/**
 * **¿Lo que hay hoy sigue siendo lo que se juzgó?**
 *
 * Ésta es la razón de existir del contorno. Sin algo congelado enfrente, el
 * expediente sólo puede enseñar lo de hoy y callar; con esto puede decir que
 * ya no cuadra, y con qué.
 *
 * `sin_acta` no es «cuadra»: es que no se puede preguntar. Se declara aparte
 * para que la pantalla no pinte un hueco como un visto bueno — la misma razón
 * por la que `candidatasSnapshot` distingue `null` de `[]`.
 */
export function cotejarContorno(
  acta: ActaDelHecho | null | undefined,
  puntosDeHoy: readonly PuntoParaLaHuella[],
): CotejoDelContorno {
  if (!acta) return { que: "sin_acta" };
  const hoy = acta.evidencia;
  if (puntosDeHoy.length !== hoy.puntos) {
    return {
      que: "no_cuadra",
      motivo: `se juzgó con ${hoy.puntos} ${hoy.puntos === 1 ? "punto" : "puntos"} y hoy hay ${puntosDeHoy.length}`,
    };
  }
  const huellaDeHoy = huellaDeLaEvidencia(puntosDeHoy);
  if (huellaDeHoy !== hoy.huella) {
    return {
      que: "no_cuadra",
      motivo: "son los mismos puntos en número, pero no los mismos: alguno cambió de hora o de lugar",
    };
  }
  return { que: "cuadra" };
}
