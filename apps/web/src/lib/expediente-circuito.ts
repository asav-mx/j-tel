import { ORIGEN_DEL_CIRCUITO } from "@jtel/domain/publico";
import { fechaCivilLarga } from "@/lib/formato-tiempo";

/**
 * Lo que el expediente del circuito AFIRMA de cada número, fuera del `.tsx`.
 *
 * Está aquí por la razón de siempre —una frase escrita dentro de un componente
 * no se puede probar sin montar la pantalla— y por una segunda que en esta
 * pantalla pesa más: **cada renglón de aquí es una promesa sobre lo que va a
 * pasar cuando alguien mueva el número.** Si la lectura dice que subir el
 * corredor publica unidades de calles vecinas, eso tiene que seguir siendo
 * cierto el día que alguien cambie el endpoint. Una promesa suelta dentro de un
 * `<p>` no la revisa nadie.
 *
 * ## Lo que este archivo NO hace
 *
 * **No decide nada.** Los umbrales los aplica `medirUnidad` en el dominio y la
 * escalera en `estadoDelCircuito`. Aquí sólo se explica qué hace cada uno.
 *
 * **No inventa valores.** Los de origen salen de `ORIGEN_DEL_CIRCUITO`, que es
 * la misma constante con la que la base los pone. Copiarlos aquí habría dejado
 * a la pantalla diciendo el número viejo el día que se mueva un default.
 */

/** Lo que el expediente necesita saber del circuito para explicarse. */
export interface CircuitoParaExpediente {
  staleAfterSeconds: number;
  serviceConfidenceMinutes: number;
  corridorToleranceMeters: number;
  stopSnapToleranceMeters: number;
  arrivalRangeFloorSeconds: number;
  avgSpeedKmh: number;
}

export interface PerillaDeMedicion {
  /** El nombre del campo en el formulario. */
  campo: string;
  rotulo: string;
  unidad: string;
  valor: number;
  paso: number;
  /** El valor con que nace todo circuito. */
  origen: number;
  /**
   * El valor guardado coincide con el de origen.
   *
   * ⚠ **No significa «nadie lo ha tocado»**, y la pantalla no lo escribe así.
   * Un 180 heredado y un 180 tecleado son indistinguibles en la base: es
   * exactamente el hueco que tenía la frecuencia declarada antes de la `0031`,
   * y lo único que lo cerraría es un registro de cambios. Decir «sin ajustar»
   * sería afirmar sobre un humano algo que el dato no sostiene.
   */
  igualAlOrigen: boolean;
  /** Qué decide este número, dicho como lo que le pasa a alguien. */
  lectura: string;
  /** De dónde salió el valor de origen. Sólo tiene sentido enseñarlo si lo es. */
  procedencia: string;
}

/**
 * Las perillas de medición, en el orden en que importan.
 *
 * **Ninguna se llama «tolerancia» a secas, y es deliberado.** Había dos —el
 * pegado de paradas (25 m) y el corredor (150 m)— y el formulario llamaba
 * «Tolerancia» a la primera mientras la segunda, que es la que decide qué
 * unidad ve el pasajero, no tenía editor. Quien buscara «la tolerancia»
 * encontraba la que no era y la podía mover. Ponerlas juntas sin renombrarlas
 * habría dejado el mismo problema con mejor acomodo: **cada rótulo dice qué
 * hace su número**, y la prueba de este archivo se cae si alguien las vuelve a
 * llamar igual.
 */
export function perillasDeMedicion(c: CircuitoParaExpediente): PerillaDeMedicion[] {
  const perillas: Array<Omit<PerillaDeMedicion, "igualAlOrigen">> = [
    {
      campo: "corredorEnRutaM",
      rotulo: "Cuenta como EN RUTA hasta",
      unidad: "m del trazado",
      valor: c.corridorToleranceMeters,
      paso: 1,
      origen: ORIGEN_DEL_CIRCUITO.corredorEnRutaMetros,
      lectura:
        "Más lejos del trazado, el sistema deja de poder afirmar que la unidad va en la ruta: " +
        "no se le dibuja al pasajero y no cuenta como en ruta en Operar. Subirlo publica " +
        "camiones que van por calles vecinas; bajarlo esconde camiones que sí van en su ruta.",
      procedencia:
        "Los 150 m salen de la geometría del archivo, no del gusto: el KML del primer circuito " +
        "tiene huecos de hasta 224 m entre vértices, y con 25 m no se publicaría casi nada.",
    },
    {
      campo: "frescuraSeg",
      rotulo: "La posición dice dónde está hasta los",
      unidad: "s",
      valor: c.staleAfterSeconds,
      paso: 1,
      origen: ORIGEN_DEL_CIRCUITO.frescuraSegundos,
      lectura:
        "Pasados esos segundos el camión se sigue viendo en el mapa —apagado, más chico y con " +
        "«hace N min»— pero deja de contar como en ruta, y el tiempo estimado desaparece: " +
        "calcularlo desde una posición vieja inventa un número que paga quien está en la banqueta.",
      procedencia: "Es el valor con que nace todo circuito. No se ha medido contra esta calle.",
    },
    {
      campo: "confianzaMin",
      rotulo: "Sigue habiendo servicio hasta los",
      unidad: "min",
      valor: c.serviceConfidenceMinutes,
      paso: 1,
      origen: ORIGEN_DEL_CIRCUITO.confianzaMinutos,
      lectura:
        "Cuánto tiempo después de ver una unidad DENTRO del corredor se puede seguir diciendo " +
        "que el servicio corre. Agotado, el camión se va del mapa y la app deja de decir la " +
        "frecuencia. No se deriva de la frecuencia a propósito: son dos perillas distintas.",
      procedencia:
        "Los 15 min son un punto de partida declarado, no una medición. Se afinan con la prueba " +
        "de campo.",
    },
    {
      campo: "velocidadKmh",
      rotulo: "Velocidad efectiva de avance",
      unidad: "km/h",
      valor: c.avgSpeedKmh,
      paso: 0.1,
      origen: ORIGEN_DEL_CIRCUITO.velocidadKmh,
      lectura:
        "Con qué velocidad se convierte en minutos la distancia que le falta al camión. " +
        "Sólo se usa si el tiempo estimado de llegada está encendido; apagado, no afecta nada.",
      procedencia:
        "20.5 km/h se midió sobre OTRA flota —9 118 ventanas, 35 aparatos, 14 días—, no sobre " +
        "este circuito. Es el motivo por el que el tiempo estimado nace apagado.",
    },
    {
      campo: "pisoRangoSeg",
      rotulo: "El tiempo estimado nunca se muestra más angosto que",
      unidad: "s",
      valor: c.arrivalRangeFloorSeconds,
      paso: 1,
      origen: ORIGEN_DEL_CIRCUITO.pisoDelRangoSegundos,
      lectura:
        "Un rango de «entre 2 y 3 min» promete una precisión que ningún GPS de flota sostiene. " +
        "Este piso es lo más angosto que la app tiene permitido decir.",
      procedencia: "Es el valor con que nace todo circuito.",
    },
    {
      campo: "pegadoParadasM",
      rotulo: "Al poner una parada, se pega al trazado hasta",
      unidad: "m",
      valor: c.stopSnapToleranceMeters,
      paso: 1,
      origen: ORIGEN_DEL_CIRCUITO.pegadoDeParadasMetros,
      lectura:
        "Sólo afecta al editor de abajo, cuando alguien pica el mapa para colocar una parada. " +
        "No decide nada de lo que ve el pasajero ni de lo que cuenta en Operar.",
      procedencia:
        "25 m es para colocar un punto a mano sobre un mapa quieto. Por eso no es el mismo " +
        "número que el del corredor, donde el camión va en movimiento.",
    },
  ];

  return perillas.map((p) => ({ ...p, igualAlOrigen: p.valor === p.origen }));
}

/**
 * Qué va a decir la app del pasajero con la frecuencia que está guardada.
 *
 * Se escribe junto al campo **antes** de guardarlo, porque dejarlo vacío es una
 * decisión legítima y quien la toma tiene que saber qué produce. La alternativa
 * —un valor sugerido en el campo— es la que ya costó: `DEFAULT 20` hacía
 * indistinguibles «el concesionario declaró 20» y «nadie declaró nada», y la app
 * afirmaba la cadencia igual en los dos casos.
 */
export function loQueDiraLaApp(frecuenciaMin: number | null): string {
  return frecuenciaMin === null
    ? "Sin frecuencia declarada la app dice que el servicio corre, y se calla el número. " +
        "Es la respuesta honesta, no una carencia que haya que llenar."
    : `La app dirá «cada ${frecuenciaMin} min» cuando no vea ningún camión en el corredor. ` +
        "Lo dice en voz alta y con el sistema detrás, así que tiene que venir del concesionario.";
}

/**
 * Qué va a hacer la app con la fecha de arranque que está guardada.
 *
 * Hermana de `loQueDiraLaApp`, y por la misma razón: dejarla vacía es una
 * decisión legítima y quien la toma tiene que saber qué produce, **antes** de
 * guardar. Aquí el hueco es más fácil de leer al revés que en la frecuencia —
 * un campo de fecha vacío se parece mucho a «arranca hoy»— y la frase existe
 * sobre todo para cerrar esa lectura.
 *
 * `hoyLocal` entra por parámetro y es la fecha civil **en la zona del
 * circuito**: la misma con la que el endpoint decide. Calcularla aquí con el
 * reloj del servidor haría que la pantalla dijera una cosa y la app hiciera
 * otra durante las horas en que las dos fechas no coinciden.
 */
export function loQueDiraDelArranque(
  arrancaEl: string | null,
  hoyLocal: string,
  zona: string,
): string {
  if (arrancaEl === null) {
    return (
      "Sin fecha, el circuito YA OPERA: la app enseña las unidades que vea y cae a los estados " +
      "de siempre. Vacío no significa «arranca hoy» — significa que no hay arranque que anunciar."
    );
  }
  if (arrancaEl > hoyLocal) {
    return (
      `Hasta el ${fechaCivilLarga(arrancaEl, zona)}, la app enseña el recorrido y lo declarado ` +
      "y dice que el servicio arranca ese día. No enseña unidades, aunque las vea, y no dice " +
      "que falte evidencia: todavía no hay nada que evidenciar."
    );
  }
  if (arrancaEl === hoyLocal) {
    /*
     * El borde se dice, no se deja al azar. «Ya pasó» sería falso hoy y «todavía
     * no» también: arrancó a las 00:00 de la zona del circuito, y desde ese
     * minuto la app ya trabaja como con cualquier circuito en marcha.
     */
    return (
      "Es hoy. Desde las 00:00 en la zona del circuito la app ya trabaja como con cualquier " +
      "circuito en marcha: enseña las unidades que vea y cae a los estados de siempre."
    );
  }
  return (
    "Esa fecha ya pasó, así que la app trabaja como con cualquier circuito en marcha. " +
    "Se queda guardada como el día en que arrancó; no hace falta borrarla."
  );
}

/**
 * En qué estado está un renglón de «cómo va armado».
 *
 * **`decidido` existe por un defecto que sólo se vio mirando la pantalla.** La
 * lista marcaba «Tiempo estimado de llegada · apagado — falta», y apagado es el
 * estado CORRECTO: nace así a propósito porque la velocidad de origen se midió
 * sobre otra flota. Ponerlo en la columna de lo que falta empuja a encenderlo, y
 * encenderlo antes de calibrar es exactamente lo que el interruptor existe para
 * impedir.
 *
 * Es §D del Marco en su forma pura: el dato era correcto —está apagado— y lo
 * falso lo puso la AGRUPACIÓN, al ponerlo junto a las carencias de verdad.
 */
export type EstadoDelRenglon =
  /** Sin esto, al pasajero le falta algo del circuito. */
  | "falta"
  /** Ya está puesto. */
  | "puesto"
  /** Es una decisión tomada, no una carencia. No se empuja a cambiarla. */
  | "decidido";

export interface RenglonDeArmado {
  que: string;
  cuanto: string;
  estado: EstadoDelRenglon;
}

/**
 * Cómo va armado el circuito — **enunciado, nunca bloqueado**.
 *
 * Publicar sin trazado es legítimo: el endpoint contesta igual, con el sentido
 * en nulo. Un candado aquí decidiría por quien opera, y quien opera es el que
 * sabe si el KML llega mañana.
 */
export function faltantesDelCircuito(entrada: {
  trazados: number;
  paradas: number;
  unidadesVigentes: number;
  frecuenciaMin: number | null;
  rangoEncendido: boolean;
  /** El día de arranque declarado, o `null` si el circuito ya opera. */
  arrancaEl: string | null;
  /** La zona del circuito, para escribir ese día como se lee. */
  zona: string;
}): RenglonDeArmado[] {
  const falta = (hay: boolean): EstadoDelRenglon => (hay ? "puesto" : "falta");
  return [
    {
      que: "Trazado",
      cuanto: `${entrada.trazados} de 2 sentidos`,
      estado: falta(entrada.trazados > 0),
    },
    {
      // Sin paradas no hay QR que imprimir: el `qr_slug` vive en la parada.
      que: "Paradas",
      cuanto: String(entrada.paradas),
      estado: falta(entrada.paradas > 0),
    },
    {
      que: "Unidades corriendo",
      cuanto: String(entrada.unidadesVigentes),
      estado: falta(entrada.unidadesVigentes > 0),
    },
    {
      /*
       * Sin declarar NO es una carencia: es la respuesta honesta cuando el
       * concesionario no la dio, y la app sabe decirla. Marcarla «falta»
       * presiona a inventar un número — que es el defecto que la 0031 cerró.
       */
      que: "Frecuencia declarada",
      cuanto: entrada.frecuenciaMin === null ? "sin declarar" : `cada ${entrada.frecuenciaMin} min`,
      estado: "decidido",
    },
    {
      /* Apagado es el estado con que nace, y el correcto hasta calibrar. */
      que: "Tiempo estimado de llegada",
      cuanto: entrada.rangoEncendido ? "encendido" : "apagado",
      estado: "decidido",
    },
    {
      /*
       * `decidido` por lo mismo que la frecuencia: **vacío es una respuesta**.
       * Un circuito que ya opera no tiene fecha de arranque, y marcarla «falta»
       * empujaría a inventar una — con el agravante de que aquí la fecha
       * inventada más a la mano es la de hoy, que además apagaría el servicio
       * hasta la medianoche.
       */
      que: "Arranque del servicio",
      cuanto: entrada.arrancaEl ? fechaCivilLarga(entrada.arrancaEl, entrada.zona) : "ya opera",
      estado: "decidido",
    },
  ];
}
