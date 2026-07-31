/**
 * La tira de la flota — dos clases y nada más. Funciones puras.
 *
 * A cincuenta y nueve unidades por pantalla, cada tira mide veinte pixeles de
 * alto y el ancho de una columna. Ahí el matiz entre "en movimiento" y
 * "detenida" no se lee: se ve como dos tonos de gris que nadie distingue de un
 * vistazo, y la pregunta de esta pantalla tampoco es esa. La pregunta de la
 * flota es **de quién tengo dato y de quién no**; la de la unidad —qué hizo,
 * dónde se paró y cuánto rodó— vive en su propia vista, donde una tira sola sí
 * se puede leer con las tres clases.
 *
 * Que sean dos clases aquí no es una simplificación del dato: es la resolución
 * a la que la pantalla puede afirmar algo. Dibujar tres donde solo se ven dos
 * sería teatro.
 *
 * Igual que en la vista de unidad, `sin_dato` NO es "apagada" ni "en patio":
 * es ausencia de observación. Y por eso nada de aquí se pinta de verde, ámbar
 * o rojo — son estados de observación, no resultados.
 */

/** Tramo observado (hubo puntos) o sin dato (no hubo). */
export type ClaseDeFlota = "observado" | "sin_dato";

export type TramoDeFlota = {
  clase: ClaseDeFlota;
  desde: Date;
  hasta: Date;
  minutos: number;
};

const MS_POR_MINUTO = 60_000;

const minutosEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / MS_POR_MINUTO;

/**
 * La tira de una unidad en la flota, a partir de los bloques que el resumen
 * de la base ya calculó.
 *
 * Los bordes cuentan como cualquier otro hueco: si la unidad no reportó entre
 * que abrió la franja y su primer punto, ese silencio es parte de la respuesta.
 * Empezar la tira en el primer dato haría ver una franja observada que nadie
 * observó.
 *
 * Los tramos de duración cero se descartan: no se pueden dibujar ni leer, y
 * dejarlos mete rayas de ancho mínimo que se ven como dato donde no hay tiempo
 * que mostrar. Los conteos del resumen siguen contando esos puntos.
 */
export function tiraDeFlota(
  franja: { desde: Date; hasta: Date },
  bloques: ReadonlyArray<{ desde: Date; hasta: Date }>,
): TramoDeFlota[] {
  const total = minutosEntre(franja.desde, franja.hasta);
  if (total <= 0) return [];

  const ordenados = [...bloques].sort((a, b) => a.desde.getTime() - b.desde.getTime());
  const tramos: TramoDeFlota[] = [];

  const empujar = (clase: ClaseDeFlota, desde: Date, hasta: Date) => {
    const minutos = minutosEntre(desde, hasta);
    if (minutos > 0) tramos.push({ clase, desde, hasta, minutos });
  };

  if (ordenados.length === 0) {
    empujar("sin_dato", franja.desde, franja.hasta);
    return tramos;
  }

  empujar("sin_dato", franja.desde, ordenados[0]!.desde);

  ordenados.forEach((bloque, i) => {
    empujar("observado", bloque.desde, bloque.hasta);
    const siguiente = ordenados[i + 1];
    empujar("sin_dato", bloque.hasta, siguiente ? siguiente.desde : franja.hasta);
  });

  return tramos;
}
