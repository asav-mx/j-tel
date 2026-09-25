import { avanceSobreTrazado, type Sentido } from "./llegada.js";

/**
 * **El número de una parada dentro de su sentido** — «Páris 7 de 18 · hacia
 * Centro» (decisión de ASAV, 25-sep-2026).
 *
 * ## Sólo pantalla. Nunca lámina.
 *
 * El número **se calcula cada vez** y no se guarda en ningún lado: si mañana se
 * inserta una parada entre la 3 y la 4, de la 4 en adelante todas se corren
 * una. En pantalla eso es gratis —la siguiente vez que se pinta ya dice lo
 * nuevo—; en un letrero atornillado a un poste es una mentira que nadie va a
 * ir a corregir. Lo estable, lo que sí se imprime, es el `qr_slug`
 * (`letrero-de-parada.ts`). La prueba de este archivo revisa que ningún
 * impreso de la casa lo importe.
 *
 * ## Por qué sale del trazado y no de la columna `orden`
 *
 * Una parada con `sentido` nulo sirve en los dos sentidos y tiene **un solo**
 * `orden`: no puede ser la 3 de ida y también la 3 de vuelta, porque de vuelta
 * se recorre al revés. El orden en que el camión pasa por las paradas de un
 * sentido es dónde caen sobre el trazado de ese sentido, y es exactamente como
 * la app ya arma la lista de paradas (`paradas-de-la-ruta.ts`) y decide el
 * «hacia ‹última parada›». Si el número saliera de otro orden, «7 de 18»
 * podría estar pintado junto al octavo renglón de la lista: dos datos
 * correctos que juntos mienten.
 *
 * Por lo mismo, una parada que **no cae en el corredor** de ese trazado no se
 * numera ni se cuenta en el total: la lista tampoco la enseña.
 */

export interface NumeroDeParada {
  /** Su lugar en el sentido, desde 1. */
  numero: number;
  /** Cuántas paradas tiene el sentido. */
  de: number;
}

export interface ParadaNumerable {
  /** El `qr_slug`: la identidad pública de la parada. */
  id: string;
  sentido: Sentido | null;
  /** Sólo desempata dos paradas que caen en el mismo metro. */
  orden: number;
  lat: number;
  lon: number;
}

/**
 * Numera las paradas de un sentido en el orden en que el camión pasa por
 * ellas. Devuelve un mapa `id → { numero, de }`; la que no está en él no tiene
 * número en ese sentido (es del otro, o no cae en el trazado). Sin trazado, el
 * mapa va vacío: sin él no hay orden que afirmar.
 */
export function numerarParadasDelSentido(
  paradas: readonly ParadaNumerable[],
  sentido: Sentido,
  trazado: Array<[number, number]> | undefined,
  corredorMetros: number,
): Map<string, NumeroDeParada> {
  const salida = new Map<string, NumeroDeParada>();
  if (!trazado || trazado.length < 2) return salida;

  const enElSentido: Array<{ id: string; orden: number; avance: number }> = [];
  for (const p of paradas) {
    if (p.sentido !== null && p.sentido !== sentido) continue;
    const donde = avanceSobreTrazado({ lat: p.lat, lon: p.lon }, trazado, corredorMetros);
    if (!donde) continue;
    enElSentido.push({ id: p.id, orden: p.orden, avance: donde.avanceMetros });
  }

  enElSentido.sort((a, b) => a.avance - b.avance || a.orden - b.orden || a.id.localeCompare(b.id));
  enElSentido.forEach((p, i) => salida.set(p.id, { numero: i + 1, de: enElSentido.length }));
  return salida;
}

/** «7 de 18». Lo demás de la frase —el nombre, el «hacia»— es de la pantalla. */
export function numeroDeParadaEnPalabras(n: NumeroDeParada): string {
  return `${n.numero} de ${n.de}`;
}
