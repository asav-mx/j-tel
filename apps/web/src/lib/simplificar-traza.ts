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

export type Punto = { lat: number; lng: number };

/**
 * Distancia perpendicular de `p` al segmento `a`–`b`, en grados proyectados.
 *
 * La longitud se corrige por el coseno de la latitud antes de medir: sin eso,
 * en Juárez (31.7°) un grado de longitud pesaría lo mismo que uno de latitud y
 * la simplificación deformaría de más en el eje este-oeste.
 */
function distanciaPerpendicular(p: Punto, a: Punto, b: Punto): number {
  const k = Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const px = (p.lng - a.lng) * k;
  const py = p.lat - a.lat;
  const bx = (b.lng - a.lng) * k;
  const by = b.lat - a.lat;

  const largo2 = bx * bx + by * by;
  if (largo2 === 0) return Math.hypot(px, py);

  // Proyección acotada al segmento: fuera de él, la distancia es al extremo.
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / largo2));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Grados de latitud que equivalen a un metro. Aproximación suficiente aquí. */
const GRADOS_POR_METRO = 1 / 111_320;

/**
 * Douglas-Peucker con tolerancia en METROS.
 *
 * La tolerancia se expresa en metros y no en grados a propósito: quien la
 * ajusta piensa en "cuánto puede alejarse la línea dibujada de donde de verdad
 * pasó el camión", y eso es una distancia en el mundo, no una unidad de mapa.
 *
 * Iterativo y no recursivo: una traza de decenas de miles de puntos casi
 * colineales desborda la pila con la versión recursiva, y ese es exactamente el
 * caso que esta función existe para atender.
 */
export function simplificarTraza(puntos: Punto[], toleranciaMetros: number): Punto[] {
  if (puntos.length <= 2 || toleranciaMetros <= 0) return puntos;
  const tolerancia = toleranciaMetros * GRADOS_POR_METRO;

  const conservar = new Uint8Array(puntos.length);
  conservar[0] = 1;
  conservar[puntos.length - 1] = 1;

  const pila: [number, number][] = [[0, puntos.length - 1]];
  while (pila.length > 0) {
    const [ini, fin] = pila.pop()!;
    let peorDist = 0;
    let peorIdx = -1;
    for (let i = ini + 1; i < fin; i += 1) {
      const d = distanciaPerpendicular(puntos[i]!, puntos[ini]!, puntos[fin]!);
      if (d > peorDist) {
        peorDist = d;
        peorIdx = i;
      }
    }
    if (peorIdx !== -1 && peorDist > tolerancia) {
      conservar[peorIdx] = 1;
      pila.push([ini, peorIdx], [peorIdx, fin]);
    }
  }

  const salida: Punto[] = [];
  for (let i = 0; i < puntos.length; i += 1) if (conservar[i]) salida.push(puntos[i]!);
  return salida;
}

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
