/**
 * El rótulo al pie de la tarjeta del pasajero — el renglón chico con el punto.
 *
 * ## La regla, y es la única que gobierna este archivo
 *
 * > **El rótulo dice DE DÓNDE SALE la afirmación. Nunca repite QUÉ ES.**
 *
 * Qué es ya lo dijeron el titular y la frase, cada uno con su lugar y su
 * tamaño. Un rótulo que lo vuelve a decir gasta el único renglón que quedaba
 * para lo que nadie más está diciendo: quién responde por lo que se está
 * afirmando.
 *
 * El caso que lo enseñó: con el titular en «05:00 a 23:00», el rótulo decía
 * «Horario declarado por el concesionario». La palabra «horario» era la misma
 * de arriba, y lo único que agregaba —la atribución— venía enterrado detrás de
 * ella. Es la misma falta que ya se había corregido dos veces en esta pantalla:
 * entre el titular y la frase el 28 de agosto, y entre el titular y el hilo de
 * paradas en el #366. **Cada renglón agrega, o no va.**
 *
 * ## La atribución NO se quita, y eso es la otra mitad
 *
 * Acortar no es callar de dónde viene. Sin el «según el concesionario», la app
 * afirma el horario **con su propia autoridad** — y nosotros no lo medimos: lo
 * declaró él. Es la misma frontera de toda la cara pública: se enseña lo
 * declarado como declarado, y lo observado como observado.
 *
 * ## Las tres familias, que es lo que hay que mirar al agregar un estado
 *
 * 1. **Lo DECLARADO** —arranque, horario, frecuencia—: la fuente es el
 *    concesionario, y el rótulo lo dice. Todos comparten copia a propósito: la
 *    fuente es la misma, y variarla por estado insinuaría que hay varias.
 * 2. **Lo MEDIDO** —«en vivo»—: la fuente es nuestro instrumento, y el rótulo
 *    lo nombra con sus números (el piso del rango, la velocidad y de dónde
 *    salió).
 * 3. **Lo que NO SE PUDO PREGUNTAR** —sin conexión, consultando—: no hay
 *    afirmación sobre el servicio, así que no hay fuente que atribuir.
 *    Atribuírsela a alguien sería inventarla, y ahí el rótulo dice lo que pasó
 *    del lado del teléfono y nada más.
 *
 * `por_horario` **no está resuelto y no se toca aquí**: la fuente de ese estado
 * es mixta —la cadencia la declaró el concesionario, y que haya servicio lo
 * vimos nosotros—, así que ni «según el concesionario» ni un rótulo de
 * instrumento le quedan sin decidir antes qué se está atribuyendo. Se deja como
 * está, dicho, en vez de escogerle una fuente de paso.
 */

export type ModoDeLaTarjeta =
  | "por_arrancar"
  | "fuera_de_horario"
  | "en_vivo"
  | "por_horario"
  | "sin_evidencia"
  | "sin_conexion"
  | "cargando";

/**
 * La atribución de todo lo declarado, en una sola copia.
 *
 * Es corta a propósito: el rótulo va en el renglón más chico de la tarjeta, y
 * ahí una frase larga se lee como letra chica — que es justo el tono que no
 * queremos para decir quién responde por lo que la app afirma.
 */
export const SEGUN_EL_CONCESIONARIO = "Según el concesionario";

/** Lo que el rótulo necesita saber del estado EN VIVO, que es el único con números. */
export interface EnVivo {
  /** Ya se puede decir un minuto: interruptor prendido y llegada calculada. */
  conRango: boolean;
  /** Hay una llegada que enseñar —el pasajero dio su ubicación—. */
  hayProxima: boolean;
  /** El piso del rango, en minutos. */
  pisoMin: number;
  velocidadKmh: number;
  /** Si la velocidad se midió en esta corrida o es la declarada del circuito. */
  velocidadMedida: boolean;
}

export function rotuloDeLaTarjeta(modo: ModoDeLaTarjeta, enVivo: EnVivo): string {
  switch (modo) {
    /*
     * Los tres declarados comparten rótulo, y no es pereza: la fuente es la
     * misma persona. Darle a cada uno su variante —«arranque declarado»,
     * «horario declarado»— insinuaría que hay tres fuentes distintas, y además
     * es por donde se volvió a colar la repetición del titular.
     */
    case "por_arrancar":
    case "fuera_de_horario":
    case "sin_evidencia":
      return SEGUN_EL_CONCESIONARIO;

    /* Del lado del teléfono. No hay servicio del cual decir nada, ni a quién
       atribuírselo: lo único cierto es que no se pudo preguntar. */
    case "sin_conexion":
      return "Sin conexión";
    case "cargando":
      return "Consultando…";

    /*
     * Sin resolver, y dicho arriba. La cadencia la declaró el concesionario y
     * el servicio lo vimos nosotros: escogerle una fuente de paso sería
     * atribuirle a alguien media afirmación.
     */
    case "por_horario":
      return "Por horario";

    /*
     * EN VIVO nombra el instrumento, que es su fuente, y con sus números: hasta
     * dónde afina el rango y de dónde salió la velocidad. «Medidos» y
     * «declarados» no son sinónimos y por eso se distinguen — una velocidad
     * declarada es un punto de partida, no una medición de esta calle.
     */
    case "en_vivo": {
      if (!enVivo.conRango) return "En vivo · sin tiempo estimado";
      if (!enVivo.hayProxima) return "En vivo · activa tu ubicación para el tiempo";
      const v = `${enVivo.velocidadKmh.toFixed(1)} km/h ${enVivo.velocidadMedida ? "medidos" : "declarados"}`;
      return `En vivo · ±${enVivo.pisoMin} min · ${v}`;
    }
  }
}
