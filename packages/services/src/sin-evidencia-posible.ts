import type { MotivoSinEvidencia } from "./motivo-sin-evidencia.js";

/**
 * Cuándo un servicio deja de esperar evidencia que no va a llegar.
 *
 * **Marco 3.10 — el árbitro que se rinde** (enmienda del 19 de septiembre de
 * 2026). Un árbitro que no puede cerrar un caso sin pruebas nunca se va del
 * estadio. Cuando el plazo venció y la evidencia no llegó, se sella «sin
 * evidencia posible» y se deja de preguntar.
 *
 * EL PROBLEMA QUE RESUELVE, MEDIDO DOS VECES. Cinco servicios de junio
 * llevaban desde el 10 de julio reintentándose cada minuto: 31 400
 * verificaciones cada uno. Se escribió esto para cortarlo — y el 19 de
 * septiembre volvió a pasar, más grande: **4 163 318 entradas sobre 1 008
 * servicios**, hasta 17 637 sobre uno solo. La regla existía y **no podía
 * engancharse**.
 *
 * ESTO NO ES UN CUARTO VEREDICTO (3.10a). Los veredictos son tres y es ley del
 * producto: `cumplido`, `no_cumplido`, `pendiente_evidencia`. Sin evidencia NO
 * es incumplimiento, y este archivo no lo convierte en uno. El veredicto se
 * queda en `pendiente_evidencia` — lo que cambia es el estado de la EVIDENCIA,
 * que describe qué se pudo observar y no qué hizo el transportista.
 *
 * ES REVERSIBLE A PROPÓSITO (3.10d). Es un estado de cola, no una sentencia:
 * una re-verificación con `force` lo ignora, y si mañana un relleno de huecos
 * trae los datos que faltaban, el servicio se puede volver a juzgar. Por eso se
 * registra en el ledger con su razón: para que alguien pueda discutirla.
 *
 * ## La regla que estaba mal planteada, y por qué se cambió
 *
 * La razón principal era `ventana_anterior_a_la_memoria`: comparaba el fin de
 * la ventana contra `min(recorded_at)` de **toda la historia** del
 * transportista. Medido el 19-sep: el primer punto de `juarez-bus` es del 28 de
 * junio, así que para cualquier ventana de septiembre **nunca podía
 * dispararse**. Un solo punto viejo, de cualquier origen, la mataba para
 * siempre. Resultado: 365 servicios atorados y el freno alcanzando a cero.
 *
 * La pregunta correcta no es cuándo empieza la historia del transportista, sino
 * **si ESTA ventana todavía puede recibir algo** (3.10b). Y esa pregunta ya se
 * contestaba dos líneas antes, en `motivoSinEvidencia`: compara contra la marca
 * de agua del archivador y distingue
 *
 *   · `memoria_no_alcanza` — el archivador todavía no llega. **Se espera.**
 *   · `sin_senal` — ya pasó de largo y no dejó ni un punto. **Se cierra.**
 *
 * `sin_senal` es, literalmente, «esta ventana ya se cerró vacía». Estaba
 * calculada, guardada en el ledger y enseñada en J-Staff — y sin conectar al
 * freno.
 */

/** Intentos previos antes de retirar algo de la cola. Un fallo transitorio no basta. */
export const MIN_INTENTOS_ANTES_DE_RETIRAR = 30;

/**
 * El respaldo (3.10c): cuánto se espera cuando NO hay marca de agua con la cual
 * afirmar nada. Generoso a propósito: equivocarse aquí es dejar sin juicio un
 * servicio que sí tenía cómo juzgarse.
 *
 * Dejó de ser la regla principal. Con marca de agua, la ventana se cierra en
 * cuanto el archivador la rebasa vacía — no a los catorce días.
 */
export const DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA = 14;

export type RazonSinEvidencia =
  /** El archivador ya pasó de largo la ventana y no dejó ni un punto (3.10b). */
  | "ventana_cerrada_vacia"
  /** Sin marca de agua que consultar, y ya pasó el plazo de respaldo (3.10c). */
  | "plazo_vencido_sin_evidencia";

export interface EntradaSinEvidencia {
  /** Fin de la ventana de evidencia del viaje. */
  finDeVentana: Date;
  /**
   * Lo que ya calculó `motivoSinEvidencia` sobre esta misma ventana, o `null`
   * cuando no hay marca de agua con la cual afirmar nada.
   *
   * Se recibe en vez de recalcularse para que las dos respuestas no puedan
   * divergir: el motivo que se escribe en el ledger y la razón por la que se
   * cierra la espera tienen que salir de la misma medición.
   */
  motivo: MotivoSinEvidencia | null;
  /**
   * Intentos previos de esta ocurrencia — el contador del viaje.
   *
   * Sale de `trips.intentos_de_verificacion` y no de contar entradas del
   * ledger: el motor dejó de escribir una entrada por intento, así que contar
   * el ledger se quedaría congelado y el freno no engancharía nunca. Es el
   * mismo error con otra ropa.
   */
  intentosPrevios: number;
  ahora: Date;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Devuelve la razón por la que este servicio ya no puede resolverse, o `null`
 * si todavía tiene sentido reintentarlo.
 *
 * Ninguna razón dispara sin intentos previos: el propósito es cortar lazos
 * infinitos, no rendirse en el primer minuto.
 */
export function razonSinEvidenciaPosible(
  entrada: EntradaSinEvidencia,
): RazonSinEvidencia | null {
  if (entrada.intentosPrevios < MIN_INTENTOS_ANTES_DE_RETIRAR) return null;

  /*
   * La razón principal (3.10b). El archivador ya tiene dato más nuevo que el
   * fin de esta ventana y dentro de ella no dejó un solo punto: la ventana se
   * cerró vacía. Es una afirmación sobre lo que existe, no una estimación.
   */
  if (entrada.motivo === "sin_senal") return "ventana_cerrada_vacia";

  /*
   * `memoria_no_alcanza` NO cierra: el archivador todavía no llega a esa
   * ventana, y eso se resuelve con tiempo. Cerrar aquí sería rendirse mientras
   * el dato viene en camino — exactamente lo que 3.10b manda no hacer.
   */
  if (entrada.motivo === "memoria_no_alcanza") return null;

  /*
   * El respaldo (3.10c), sólo cuando no hay marca de agua: sin ella no se
   * puede afirmar si la ventana se cerró vacía o si el archivador viene
   * atrasado, y elegir sería inventarlo. Entonces manda el reloj.
   */
  const diasVencido = (entrada.ahora.getTime() - entrada.finDeVentana.getTime()) / DIA_MS;
  if (diasVencido > DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA) {
    return "plazo_vencido_sin_evidencia";
  }

  return null;
}

/** Cómo se cuenta en el ledger, para que un humano pueda discutirlo. */
export function explicarRazon(razon: RazonSinEvidencia): string {
  switch (razon) {
    case "ventana_cerrada_vacia":
      return "El archivador ya tiene datos de este transportista más nuevos que el fin de la ventana de evidencia de este servicio, y dentro de la ventana no dejó un solo punto. La ventana se cerró vacía: no hay de dónde salga evidencia de este servicio.";
    case "plazo_vencido_sin_evidencia":
      return `No hay marca de agua del archivador con la cual afirmar si la ventana se cerró vacía, y pasaron más de ${DIAS_ANTES_DE_ACEPTAR_QUE_NO_LLEGA} días desde su fin sin que apareciera evidencia.`;
  }
}
