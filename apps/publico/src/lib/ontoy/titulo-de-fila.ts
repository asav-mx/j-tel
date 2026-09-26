/**
 * **¿El título de una fila de llegada va arriba, en su propio renglón?**
 *
 * En la asomada y en la hoja del letrero, la fila lleva placa · título y apoyo ·
 * cifra (lámina `2-mapa/01`: «51 | hacia Centro | 2 paradas»). Con un destino
 * corto el título cabe junto a la placa, como en la lámina. Con uno largo
 * —«hacia Central de Autobuses Los Ángeles»— la columna de en medio mide
 * ~110 px a 320 de ancho y el título se partía en cuatro renglones de una o dos
 * palabras. Arriba, a todo lo ancho, se parte en dos renglones bien partidos
 * (regla de nombres largos, ASAV 26-sep: nunca «…», nunca mal partido).
 *
 * 20 caracteres: «hacia Centro Norte» (18) sigue junto a la placa.
 */
export const TITULO_QUE_CABE_JUNTO = 20;

export function tituloArriba(titulo: string | null | undefined): boolean {
  return !!titulo && titulo.trim().length > TITULO_QUE_CABE_JUNTO;
}
