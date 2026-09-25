/**
 * **A partir de qué acercamiento Tino se dibuja entero.**
 *
 * El §9 del handoff lo dice al revés y es lo mismo: «zoom lejos: Tino → punto
 * del color de la ruta». O sea que de cerca **sí** es Tino — en cualquier vista,
 * no sólo con una ruta abierta.
 *
 * ## De dónde sale el 14, medido y no escogido a ojo
 *
 * La pregunta es cuántos Tinos caben sin taparse, así que la cuenta es la
 * separación real entre paradas contra el tamaño del muñeco.
 *
 * **La separación real** se midió sobre el circuito que arranca el 1 de octubre
 * —**Oasis–Centro, 17 paradas a 667 m** una de otra, parejo— y no sobre los
 * escenarios sembrados: los de prueba tienen 4 paradas a 1.3 km, y con ésos el
 * umbral habría salido dos zooms más permisivo. La separación apretada es la de
 * la calle.
 *
 * **El tamaño** que manda no es el dibujo (32 px) sino **su caja de toque, 44**:
 * dos Tinos que no se tapan pero cuyos toques sí se enciman son dos paradas de
 * las que sólo se puede abrir una.
 *
 * A la latitud de Juárez (31.7°), con 667 m entre paradas:
 *
 * | zoom | m/px | 667 m en pixeles | |
 * |---|---|---|---|
 * | 12 | 32.52 | 20.5 px | se encaraman |
 * | **13** | 16.26 | **41.0 px** | **se tocan: menos que los 44 del toque** |
 * | **14** | 8.13 | **82.0 px** | **caben con holgura** |
 * | 15 | 4.06 | 164.1 px | de sobra |
 *
 * Así que **14**. El 13 queda fuera por 3 px, y es el margen correcto para
 * equivocarse: de más se ven puntos un acercamiento de más, de menos se tocan.
 *
 * ## Qué NO decide esto
 *
 * **No decide si las paradas se ven.** Eso es el interruptor del pasajero. Esto
 * decide **de qué tamaño** se dibujan las que ya decidió ver.
 */
export const ZOOM_DE_TINO = 14;

/** Con este acercamiento, ¿Tino entero o punto? */
export function tinoEntero(zoom: number): boolean {
  return zoom >= ZOOM_DE_TINO;
}
