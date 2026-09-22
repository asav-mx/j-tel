import { contraste } from "./contraste-de-ruta";

/**
 * El texto sobre el color de una ruta — **el piso de contraste del tinte**
 * (8.8d; Ontoy 2.0, PR 3).
 *
 * La cabeza de una ruta abierta lleva el color de la ruta de fondo, y su texto
 * se ESCOGE, no se asume blanco: una ruta amarilla o verde limón voltea a texto
 * oscuro. El piso es **4.5:1**, el del texto normal — en la cabeza hay botones
 * chicos, no sólo el nombre grande.
 *
 * El orden de preferencia es la tinta de Ontoy y el blanco, que son los de la
 * piel. Pero con los tonos medios (un rojo, un verde medio, un gris) **ninguno
 * de los dos llega a 4.5**; ahí se cae a negro o blanco puros, y uno de los
 * dos siempre llega: el peor caso es una luminancia de 0.179, donde los dos dan
 * 4.58. La prueba barre el espectro para que eso no sea una promesa.
 */

export const PISO_DEL_TEXTO = 4.5;
const TINTA = "#22282e";
const BLANCO = "#ffffff";
const NEGRO = "#000000";

export function textoSobreLaRuta(colorDeRuta: string): { color: string; contraste: number } {
  const medir = (c: string) => ({ color: c, contraste: contraste(colorDeRuta, c) ?? 0 });
  const mejorDeLaPiel = [medir(TINTA), medir(BLANCO)].sort((a, b) => b.contraste - a.contraste)[0]!;
  if (mejorDeLaPiel.contraste >= PISO_DEL_TEXTO) return mejorDeLaPiel;
  return [medir(NEGRO), medir(BLANCO)].sort((a, b) => b.contraste - a.contraste)[0]!;
}
