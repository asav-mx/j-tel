/**
 * **«Encontré 1 ruta y 3 paradas.»** — el resumen de lo que salió de la
 * búsqueda.
 *
 * Vive fuera del componente por la razón de siempre: una frase con plurales
 * dentro de un `.tsx` no se puede probar sin montar la pantalla, y **los
 * plurales del español son donde estas frases se rompen** — «1 rutas», «1
 * paradas», «0 rutas y 1 paradas».
 *
 * ## Lo que la frase NO dice
 *
 * **No dice cuántas hay en total**, dice cuántas se están enseñando. La lista
 * se recorta a un máximo y el renglón de abajo ya avisa cuántas quedaron
 * fuera; un «Encontré 40» arriba de una lista de 8 sería el §D del Marco —el
 * dato correcto con la afirmación falsa sobre lo que tienes delante.
 */
export function encontre(rutas: number, paradas: number): string {
  const r = rutas === 1 ? "1 ruta" : `${rutas} rutas`;
  const p = paradas === 1 ? "1 parada" : `${paradas} paradas`;
  if (rutas > 0 && paradas > 0) return `Encontré ${r} y ${p}.`;
  if (rutas > 0) return `Encontré ${r}.`;
  return `Encontré ${p}.`;
}
