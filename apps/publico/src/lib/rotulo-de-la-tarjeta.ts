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
 * ## La segunda regla: EL RÓTULO SIGUE LA FUENTE DEL TITULAR, NO EL ESTADO
 *
 * > Si arriba está lo que el concesionario **declaró**, «Según el
 * > concesionario». Si arriba está lo que **medimos nosotros**, un rótulo de
 * > instrumento que diga qué vimos y cuándo.
 *
 * El estado no basta para escoger, y `por_horario` es la prueba: **el mismo
 * estado cambia de fuente según haya o no cadencia declarada.** Con ella, el
 * titular es «Cada 20 min» y es suya. Sin ella, el titular es «En servicio», y
 * eso salió de nuestro GPS. Un rótulo atado al estado le pone la misma firma a
 * las dos, y una de las dos firmas es falsa.
 *
 * ### Por qué importa, y no es una sutileza de redacción
 *
 * Atribuirle al concesionario algo que medimos nosotros no es «atribuir de
 * más»: es **poner nuestra medición en su boca**. El día que el GPS se
 * equivoque —un aparato que reporta desde el patio, una posición vieja que se
 * coló— el rótulo le carga a él nuestra falla, firmada con su nombre delante
 * del pasajero.
 *
 * Es **la ley de no exponer al operador, invertida**. Aquélla prohíbe contarle
 * al pasajero que nuestra telemetría falló, porque esa falla es nuestra y su
 * lugar es el centro de control del carrier. Ésta prohíbe lo simétrico:
 * firmar con el nombre del operador una afirmación que no es suya.
 *
 * ### Las tres fuentes
 *
 * | Fuente del titular | Quién responde | Rótulo |
 * |---|---|---|
 * | **Declarada** — arranque, horario, frecuencia, cadencia | el concesionario | «Según el concesionario» |
 * | **Medida** — «en vivo», «en servicio» | nuestro instrumento | qué vimos y cuándo |
 * | **Ninguna** — sin conexión, consultando | nadie | qué pasó del lado del teléfono |
 *
 * Los declarados comparten copia a propósito: la fuente es la misma persona, y
 * variarla por estado insinuaría que hay varias. Los de fuente ninguna no se
 * atribuyen: no hay afirmación sobre el servicio que atribuir, y colgarle a
 * alguien un silencio que es nuestro sería inventar la fuente.
 *
 * Y **ningún rótulo nombra su modo**: «Por horario» era el último que lo hacía.
 * El modo es vocabulario nuestro, no del pasajero.
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

/**
 * De dónde sale la afirmación del titular. **Es lo que gobierna el rótulo**, y
 * por eso se calcula aparte: dejar que cada rótulo la deduzca del estado es
 * exactamente cómo `por_horario` acabó firmando con el nombre del concesionario
 * una medición nuestra.
 */
export type FuenteDelTitular = "declarada" | "medida" | "ninguna";

/**
 * @param hayFrecuenciaDeclarada Si el concesionario declaró cada cuánto pasa.
 *   **No es un detalle de `por_horario`: es lo que decide de quién es el
 *   titular en ese estado**, porque con cadencia el titular es «Cada 20 min» y
 *   sin ella es «En servicio».
 */
export function fuenteDelTitular(
  modo: ModoDeLaTarjeta,
  hayFrecuenciaDeclarada: boolean,
): FuenteDelTitular {
  switch (modo) {
    /* El día, la hora de apertura y —con o sin frecuencia— el horario: todo
       sale del expediente, nada de una medición nuestra. */
    case "por_arrancar":
    case "fuera_de_horario":
    case "sin_evidencia":
      return "declarada";

    /*
     * EL ESTADO QUE CAMBIA DE FUENTE. Con cadencia declarada el titular es
     * suya; sin ella el titular es «En servicio», que salió de que nuestro GPS
     * vio una unidad en el corredor. Mismo estado, dos dueños.
     */
    case "por_horario":
      return hayFrecuenciaDeclarada ? "declarada" : "medida";

    /* El camión moviéndose en el mapa es verdad observada, y es nuestra. */
    case "en_vivo":
      return "medida";

    /* No hay afirmación sobre el servicio: no se pudo preguntar. */
    case "sin_conexion":
    case "cargando":
      return "ninguna";
  }
}

/**
 * Cuántos minutos hace que se vio esa unidad, **con el mismo redondeo que la
 * pastilla del camión apagado del mapa**.
 *
 * Vive aquí para que las dos no se separen: el rótulo y la pastilla hablan del
 * mismo camión en la misma pantalla, y que una dijera «hace 6 min» mientras la
 * otra dice «hace 7» es la clase de contradicción que el pasajero sí ve.
 *
 * El piso de 1 no es cosmética: `Math.round` de 20 segundos da 0, y «hace 0
 * min» es una forma rara de decir «ahorita» — que es justo lo que este estado
 * no puede afirmar.
 */
export function minutosDesdeQueSeVio(antiguedadSeg: number): number {
  return Math.max(1, Math.round(antiguedadSeg / 60));
}

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

export interface DatosDelRotulo {
  /** Decide de quién es el titular en `por_horario`. Ver `fuenteDelTitular`. */
  hayFrecuenciaDeclarada: boolean;
  /**
   * Hace cuántos minutos se vio la unidad **más reciente** de las publicadas.
   * `null` si no hay ninguna — y entonces el rótulo dice qué vimos sin inventar
   * cuándo.
   */
  vistoHaceMin: number | null;
  enVivo: EnVivo;
}

export function rotuloDeLaTarjeta(modo: ModoDeLaTarjeta, datos: DatosDelRotulo): string {
  /*
   * LA FUENTE PRIMERO, EL ESTADO DESPUÉS. Es el orden que arregla el defecto:
   * preguntar por el estado y deducir la fuente es lo que hacía que
   * `por_horario` firmara con el nombre del concesionario una medición nuestra.
   */
  const fuente = fuenteDelTitular(modo, datos.hayFrecuenciaDeclarada);

  /*
   * Los declarados comparten rótulo, y no es pereza: la fuente es la misma
   * persona. Darle a cada uno su variante —«arranque declarado», «horario
   * declarado»— insinuaría que hay varias fuentes, y además es por donde se
   * coló la repetición del titular.
   */
  if (fuente === "declarada") return SEGUN_EL_CONCESIONARIO;

  if (fuente === "ninguna") {
    /* Del lado del teléfono. No hay servicio del cual decir nada, ni a quién
       atribuírselo: lo único cierto es que no se pudo preguntar. */
    return modo === "sin_conexion" ? "Sin conexión" : "Consultando…";
  }

  /*
   * EN VIVO nombra el instrumento con sus números: hasta dónde afina el rango y
   * de dónde salió la velocidad. «Medidos» y «declarados» no son sinónimos y
   * por eso se distinguen — una velocidad declarada es un punto de partida, no
   * una medición de esta calle.
   */
  if (modo === "en_vivo") {
    const { conRango, hayProxima, pisoMin, velocidadKmh, velocidadMedida } = datos.enVivo;
    if (!conRango) return "En vivo · sin tiempo estimado";
    if (!hayProxima) return "En vivo · activa tu ubicación para el tiempo";
    const v = `${velocidadKmh.toFixed(1)} km/h ${velocidadMedida ? "medidos" : "declarados"}`;
    return `En vivo · ±${pisoMin} min · ${v}`;
  }

  /*
   * POR HORARIO sin cadencia declarada: el titular «En servicio» es nuestro, y
   * el rótulo dice **qué vimos y cuándo** — como la pastilla del camión apagado
   * del mapa, que es el mismo camión.
   *
   * En presente no se puede: no estamos viendo una unidad ahorita, vimos una
   * dentro de la ventana de confianza. Por eso el verbo va en pasado y con su
   * minuto.
   */
  return datos.vistoHaceMin === null
    ? "Vimos una unidad en la ruta"
    : `Vimos una unidad en la ruta hace ${datos.vistoHaceMin} min`;
}
