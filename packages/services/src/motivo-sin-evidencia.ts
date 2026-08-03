/**
 * Cuando no llegó un punto: ¿la memoria todavía no alcanza esa ventana, o el
 * camión de verdad no transmitió?
 *
 * SON DOS COSAS DISTINTAS Y HOY SE VEN IGUAL. La primera es paciencia —el
 * archivador tarda una media de ~7 h y un p95 de ~30 h en cubrir una ventana,
 * medido el 2026-08-03—, y se arregla sola. La segunda es una falla real de la
 * operación. Confundirlas hace que J-Staff persiga camiones que sí
 * transmitieron, o que ignore los que no.
 *
 * ⚠️ ESTO NO SE LE MUESTRA AL CLIENTE. ⚠️
 *
 * Vive en el ledger y en la cara J-Staff, y en ningún otro lado. La planta
 * sigue viendo `pendiente_evidencia` y nada más. No es un cuarto estado
 * disfrazado ni un motivo que se asome a la cara del cliente: es instrumental
 * interno para saber a quién llamar.
 *
 * El dato con el que se decide es la marca de agua del archivador —hasta qué
 * instante tiene dato guardado ese transportista—, así que es una medición,
 * no una interpretación.
 */

export type MotivoSinEvidencia =
  /** El archivador todavía no llega a esa ventana. Se resuelve con tiempo. */
  | "memoria_no_alcanza"
  /** El archivador ya pasó de largo esa ventana y no dejó ni un punto. */
  | "sin_senal";

export interface EntradaMotivo {
  /** Fin de la ventana de evidencia del viaje. */
  finDeVentana: Date;
  /**
   * Dato de GPS más nuevo que el archivador tiene guardado para ese carrier, o
   * `null` si no hay marca de agua.
   */
  marcaDeAgua: Date | null;
}

/**
 * Devuelve el motivo, o `null` cuando no se puede afirmar ninguno.
 *
 * Sin marca de agua se devuelve `null` a propósito: sin ella no sabemos hasta
 * dónde llegó el archivador, y elegir un motivo sería inventarlo. La ausencia
 * declarada vale más que una causa verosímil.
 */
export function motivoSinEvidencia(entrada: EntradaMotivo): MotivoSinEvidencia | null {
  if (!entrada.marcaDeAgua) return null;
  return entrada.marcaDeAgua.getTime() >= entrada.finDeVentana.getTime()
    ? "sin_senal"
    : "memoria_no_alcanza";
}

/** Cómo se lee en la cara J-Staff. Nunca en la del cliente. */
export function explicarMotivo(motivo: MotivoSinEvidencia): string {
  switch (motivo) {
    case "memoria_no_alcanza":
      return "El archivador todavía no cubre esta ventana: aún no hay con qué juzgar. Se resuelve solo cuando la ingesta se ponga al día.";
    case "sin_senal":
      return "El archivador ya pasó de esta ventana y no guardó ni un punto: la unidad no transmitió. Esto no se arregla esperando.";
  }
}
