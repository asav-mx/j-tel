/**
 * Simplificación de traza para explorar. **Nunca para un servicio.**
 *
 * La ley está en `Ficha-Workbench` §3.3 y se decidió con los números medidos:
 * la cadencia real es **un punto por minuto** (mediana y p90 los dos en 60 s), y
 * tres unidades por un mes son **124 396 puntos**. Explorar así no se sostiene.
 *
 * Pero un punto por minuto no es telemetría dispersa: **cada punto puede ser el
 * que decide una disputa.** Por eso simplificar está permitido para la vista
 * general y prohibido para la ventana de un servicio, donde la traza va
 * completa. Y por eso la vista simplificada tiene que declararlo visible, no
 * con un asterisco al pie.
 *
 * **Douglas-Peucker y no muestreo por distancia**, y la diferencia importa:
 * Douglas-Peucker conserva los vértices donde la traza cambia de dirección, que
 * es justo donde se ve una desviación. El muestreo por distancia puede saltarse
 * una vuelta entera — deja los puntos parejos y borra la esquina.
 */

/*
 * El algoritmo se mudó a `@jtel/domain` (simplificar-traza.ts) para que el
 * recorrido de Compás dibuje con la misma regla. Se reexporta para no mover a
 * quien ya lo importaba de aquí; sin opciones se comporta igual que antes.
 */
export { simplificarTraza, type Punto } from "@jtel/domain";

/**
 * La tolerancia que le toca a un rango, y su razón.
 *
 * Un día se dibuja completo: 1 593 puntos medidos para la unidad más activa, y
 * eso el navegador lo dibuja sin ayuda. La simplificación entra cuando la
 * composición crece, y crece con el número de puntos, no con el de días — por
 * eso se decide sobre el total y no sobre el calendario.
 */
export function toleranciaParaTraza(totalPuntos: number): number {
  if (totalPuntos <= 3_000) return 0; // completa
  if (totalPuntos <= 20_000) return 8;
  if (totalPuntos <= 60_000) return 20;
  return 40;
}
