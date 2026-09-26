/**
 * **El horario de servicio, dicho como la lámina** `2-mapa/03-mapa-hoja-completa`:
 * «Hoy de 5:30 a 22:30 · según la concesión».
 *
 * La hora va sin cero a la izquierda («5:30», no «05:30»), como la escribe la
 * lámina y como se dice en la calle. Un servicio que cruza la medianoche se dice
 * tal cual («de 22:00 a 6:00»): no hay que inventarle un día. Y uno de 24 horas
 * —inicio igual a fin, como lo lee `enHorarioDeServicio`— es «Todo el día».
 *
 * Sale de `circuits.service_start_local / service_end_local`, que declara la
 * concesión; por eso lleva su firma en la hoja. No depende del día de la
 * semana (el horario del circuito es uno solo), así que «Hoy» es cierto
 * cualquier día.
 */
export function horaSinCero(hhmm: string): string {
  const [h, m] = hhmm.slice(0, 5).split(":");
  return `${Number(h)}:${m}`;
}

export function horarioEnPalabras(inicio: string, fin: string): string | null {
  const a = inicio.slice(0, 5);
  const b = fin.slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) return null;
  if (a === b) return "Todo el día";
  return `Hoy de ${horaSinCero(a)} a ${horaSinCero(b)}`;
}
