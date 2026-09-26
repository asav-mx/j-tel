import type { Sentido } from "@/lib/ontoy/forma";

/**
 * **Cuándo la hoja completa enseña los dos sentidos, y en qué orden.**
 *
 * Decisión de ASAV (25-sep): «como la lámina». La lámina `03-hoja-completa`
 * enseña, para una parada donde paran los dos sentidos, «Hacia Centro» y
 * «Hacia Tecnológico», cada uno con sus filas. La media de la misma parada
 * enseña uno. No hay control de sentido: lo que cambia es la altura.
 *
 * Esto sólo decide si hay dos grupos y cuáles; la hoja decide enseñarlos al
 * subir hasta arriba. Vive aquí, sin React, para poder probar la regla.
 *
 * ## Cuándo NO hay grupos (`null`)
 *
 * - **La parada es de un sentido.** No hay otro que enseñar.
 * - **La ruta no tiene trazado de los dos.** Sin trazado no hay cómo contar
 *   paradas en ese sentido, y un grupo vacío con título sería un «hacia
 *   Tecnológico» que no dice nada.
 * - **Ningún sentido tiene una unidad medida.** «Sin unidad a la vista» bajo
 *   dos títulos es la misma frase dos veces, no dos respuestas; y «Fuera de
 *   horario» dos veces, igual.
 */
export function gruposPorSentido<L extends { placa?: string }>(entrada: {
  /** `null` = la parada sirve a los dos sentidos. */
  sentidoDeLaParada: Sentido | null;
  hayTrazado: (s: Sentido) => boolean;
  /** El sentido que la hoja traía: va primero. */
  sentidoActual: Sentido;
  llegadasEn: (s: Sentido) => L[];
  /** «hacia Centro», o `null` si el sentido no tiene a dónde decir que va. */
  nombreDe: (s: Sentido) => string | null;
}): Array<{ sentido: Sentido; titulo: string; llegadas: L[] }> | null {
  const { sentidoDeLaParada, hayTrazado, sentidoActual, llegadasEn, nombreDe } = entrada;
  if (sentidoDeLaParada !== null) return null;
  if (!hayTrazado("ida") || !hayTrazado("vuelta")) return null;
  /* El que el pasajero estaba leyendo va primero: subir la hoja no tiene por
     qué cambiarle el orden de lo que ya leyó. */
  const orden: Sentido[] = sentidoActual === "vuelta" ? ["vuelta", "ida"] : ["ida", "vuelta"];
  const grupos = orden.map((s) => ({ sentido: s, titulo: tituloDeSentido(nombreDe(s), s), llegadas: llegadasEn(s) }));
  if (!grupos.some((g) => g.llegadas.some((l) => l.placa))) return null;
  return grupos;
}

/**
 * «hacia Centro» → «Hacia Centro», como el título de la lámina. Sin destino
 * que nombrar se dice «Ida» o «Vuelta», que es lo que el dato sí alcanza.
 */
export function tituloDeSentido(nombre: string | null, s: Sentido): string {
  if (!nombre) return s === "ida" ? "Ida" : "Vuelta";
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}
