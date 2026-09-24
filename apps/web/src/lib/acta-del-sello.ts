import { cotejarContorno, type ActaDelHecho, type CotejoDelContorno } from "@jtel/domain";

/**
 * **Qué acta gobierna lo que el expediente enseña** — C24, Tramo 4.
 *
 * Hermana de `politica-del-sello.ts`, y por la misma razón. Aquél decide si la
 * política que se lee es la del sello o la del contrato vivo; éste decide si
 * la ventana, las unidades y los nombres salen del acta congelada o de las
 * filas de hoy — y **lo declara**, en vez de que la pantalla tenga que
 * adivinarlo.
 *
 * ## Por qué hace falta declarar el origen
 *
 * Los 2 593 hechos sellados antes de esta columna **no tienen acta y no se les
 * va a inventar una**: deducirla con los datos de hoy sería escribir dentro de
 * un expediente sellado algo que nadie observó (Marco §E). Así que el
 * expediente de uno de ésos sigue armándose con datos de hoy — que es lo único
 * que hay— y **tiene que decirlo con palabras**. Un expediente que enseña lo
 * de hoy sin avisar afirma que así se juzgó, y eso es exactamente C24.
 *
 * ## El cotejo del contorno
 *
 * Cuando sí hay acta, además se compara lo guardado contra lo que hay hoy.
 * Ésa es la razón de existir del contorno: poder **decir** que ya no cuadra en
 * vez de callarse. `sin_acta` no es «cuadra»: es que no se puede preguntar.
 */

export type OrigenDelActa = "acta" | "hoy";

export interface LecturaDelActa {
  readonly origen: OrigenDelActa;
  /** El acta, si la hay. La pantalla no debería leerla directo. */
  readonly acta: ActaDelHecho | null;
  readonly contorno: CotejoDelContorno;
}

/** Una unidad, en las palabras del acta: `2120 (ABC-123)`. */
export function unidadEnPalabras(
  u: { economico: string; placas: string | null } | null | undefined,
): string | null {
  if (!u) return null;
  return u.placas ? `${u.economico} (${u.placas})` : u.economico;
}

export function lecturaDelActa(
  hecho: { actaSnapshot?: unknown } | null | undefined,
  puntosDeHoy: ReadonlyArray<{ recordedAt: Date | string; latitude: number; longitude: number }>,
): LecturaDelActa {
  const cruda = hecho?.actaSnapshot;
  /*
   * `jsonb` llega sin garantía de forma. Se comprueba lo mínimo que la hace
   * utilizable —que traiga su contorno— en vez de confiar en el tipo: una fila
   * escrita por una versión anterior del motor no tiene por qué cumplirlo.
   */
  const acta =
    cruda && typeof cruda === "object" && "evidencia" in cruda
      ? (cruda as ActaDelHecho)
      : null;

  return {
    origen: acta ? "acta" : "hoy",
    acta,
    contorno: cotejarContorno(acta, puntosDeHoy),
  };
}

/**
 * Lo que la pantalla dice cuando el hecho se selló antes del acta.
 *
 * Es la frase que pidió Asav, y dice las tres cosas que importan: **cuándo**
 * pasó, **qué estás viendo** y **por qué puede no ser lo que se juzgó**.
 */
export const SIN_ACTA_EN_PALABRAS =
  "Se selló antes de que se guardara su acta; lo que ves se arma con datos de hoy, que pudieron cambiar.";
