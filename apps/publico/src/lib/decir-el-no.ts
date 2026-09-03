import type { MotivoDeNoServir, ResultadoDeBusqueda } from "@jtel/domain";

/**
 * Cómo se dice que ninguna ruta sirve, sin decir de más.
 *
 * Vive fuera del componente porque **es la parte que ya se equivocó una vez** y
 * la que ninguna prueba de datos alcanza: el motivo que devuelve el dominio era
 * correcto y el titular de encima lo contradecía. Aquí se puede probar que las
 * dos mitades dicen lo mismo.
 */

// ── Distancias ───────────────────────────────────────────────────────────

/** Metros a la decena; kilómetros con un decimal pasando los mil. */
export function distancia(metros: number): string {
  return metros > 1000 ? `${(metros / 1000).toFixed(1)} km` : `${Math.round(metros / 10) * 10} m`;
}

/**
 * Lo que camina el pasajero hasta un extremo del viaje.
 *
 * **Por debajo del grano de redondeo no se dice un número.** `distancia()`
 * redondea a la decena, así que todo lo que quede a menos de cinco metros salía
 * como «a 0 m de donde estás» — literalmente cierto, y se lee como un defecto.
 * Afirmar los metros exactos ahí sería peor: el GPS de un teléfono no distingue
 * cinco metros, y «a 3 m» sería precisión inventada.
 *
 * El umbral es el del redondeo, no uno de producto: si `distancia()` no lo
 * puede decir, esto no lo dice.
 */
export function aPie(metros: number, deQue: string): string {
  return metros < 10 ? `justo ${deQue}` : `a ${distancia(metros)} ${deQue}`;
}

// ── El titular ───────────────────────────────────────────────────────────

export type TituloDelNo =
  | "a_un_paso"
  | "solo_el_sentido"
  | "no_pasa_cerca";

/**
 * Qué titular corresponde, dado lo que de verdad pasó.
 *
 * **El titular tiene que decir la verdad de lo que hay debajo.** La primera
 * versión decía siempre «ninguna pasa cerca de ahí», y con el motivo «pasa por
 * los dos, pero en el otro sentido» tres renglones abajo la pantalla se
 * contradecía a sí misma: el titular negaba justo lo que la razón afirmaba.
 *
 * Es la §D del Marco —lo falso lo puso el ALCANCE: un titular hablando de
 * distancia sobre un caso que no era de distancia— y es la misma forma que ya
 * se pagó entre el titular y el hilo de paradas en el #366.
 */
export function tituloDelNo(motivos: MotivoDeNoServir[]): TituloDelNo {
  if (motivos.includes("mejor_camina")) return "a_un_paso";
  if (motivos.includes("en_ese_orden_no")) return "solo_el_sentido";
  return "no_pasa_cerca";
}

export const TITULARES: Record<TituloDelNo, string> = {
  a_un_paso: "Estás a unos pasos: es más rápido caminar",
  solo_el_sentido: "Ninguna de las rutas publicadas va en ese sentido",
  /*
   * Habla de LAS RUTAS PUBLICADAS, nunca de la ciudad. «No hay cómo llegar»
   * sería un veredicto sobre un universo que el sistema no midió — la misma
   * falta que decía «ahorita no hay unidades en servicio» cuando lo único
   * cierto era que no teníamos evidencia.
   */
  no_pasa_cerca: "Ninguna de las rutas publicadas pasa cerca de ahí",
};

/**
 * Si toca ofrecer «estamos creciendo».
 *
 * Contesta a un problema de COBERTURA. Cuando la ruta sí pasa por los dos
 * puntos —o cuando el viaje es de una cuadra— la cobertura no es lo que falló,
 * y ofrecerlo ahí sería contestar otra pregunta.
 */
export function tocaDecirQueCrecemos(titulo: TituloDelNo): boolean {
  return titulo === "no_pasa_cerca";
}

// ── El motivo, por ruta ──────────────────────────────────────────────────

/** El motivo con su número cuando lo hay; un hueco declarado cuando no. */
export function porQueNo(r: ResultadoDeBusqueda): string {
  if (r.sirve) return "";
  const cerca = r.caminataDeDondeEstasMetros;
  const lejos = r.caminataDeDondeVasMetros;
  switch (r.motivo) {
    case "lejos_de_donde_vas":
      return lejos === null
        ? "no pasa cerca de a dónde vas"
        : `pasa a ${distancia(lejos)} de a dónde vas`;
    case "lejos_de_donde_estas":
      return cerca === null
        ? "no pasa cerca de donde estás"
        : `pasa a ${distancia(cerca)} de donde estás`;
    case "en_ese_orden_no":
      return "pasa por los dos, pero en el otro sentido";
    case "mejor_camina":
      return "los dos puntos están sobre la misma cuadra: es más rápido caminar";
    case "los_dos_lejos":
      return cerca === null || lejos === null
        ? "no pasa cerca de ninguno de los dos"
        : `pasa a ${distancia(cerca)} de donde estás y a ${distancia(lejos)} de a dónde vas`;
  }
}
