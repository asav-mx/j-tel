import { proyectarSobreTrazado } from "./trazado.js";
import { metrosEntre } from "./kml-circuito.js";
import type { Sentido } from "./llegada.js";

/**
 * ¿Esta ruta te lleva de donde estás a donde vas?
 *
 * Todo esto corre **en el teléfono**, igual que el cálculo de llegada y por la
 * misma razón: el origen es la ubicación del pasajero y el destino dice de él
 * todavía más —su casa, su trabajo, un hospital—. Ninguno de los dos sale del
 * dispositivo, y no es una promesa de política: la petición que los mandaría no
 * existe. Por eso esto vive en el dominio y no en una ruta.
 *
 * ## Lo que esta función SÍ afirma, y lo que no
 *
 * Contesta sobre **un circuito**, midiendo dos cosas que el sistema conoce: a
 * qué distancia del trazado quedan los dos puntos, y si el destino va **por
 * delante** del origen sobre ese trazado.
 *
 * No contesta si hay forma de llegar. Un `no` de aquí significa «esta ruta no
 * te sirve», nunca «no hay cómo ir» — la app tiene una sola ruta publicada y
 * la ciudad entera afuera. Quien junta los resultados de varios circuitos y
 * redacta el «no» es la pantalla, y ahí está escrito de qué puede hablar.
 *
 * Es la misma frontera que separó `sin_servicio` de `sin_evidencia` en la
 * escalera de estados: que no veamos algo no autoriza a afirmar que no está.
 *
 * ## Y no combina rutas
 *
 * Un transbordo no se propone. Está fuera del Tramo JB por decisión escrita, y
 * con una sola ruta publicada no habría con qué combinar de todas formas.
 */

// ── El umbral de caminata ────────────────────────────────────────────────

/**
 * Cuánto camina un pasajero hasta la ruta, en metros.
 *
 * **Es declarado, no medido, y conviene que se note.** Nadie ha medido cuánto
 * camina un pasajero en Juárez para alcanzar un camión; sale de la prueba de
 * campo, y hasta entonces éste es un punto de partida escrito, no un hallazgo.
 *
 * Es parámetro con default y no constante escondida, misma forma que
 * `LLEGANDO_METROS`: si un corredor pide otro número, se vuelve columna del
 * circuito como los demás umbrales.
 *
 * **Coincide en valor con `LLEGANDO_METROS` y aun así va aparte.** Aquél dice a
 * qué distancia un camión «se ve venir»; éste, cuánto está dispuesto a caminar
 * alguien. Son dos cosas distintas que hoy dan el mismo número, y compartir la
 * constante haría que afinar una moviera la otra sin que nadie lo notara — que
 * es exactamente por lo que la ventana de confianza no se derivó de la
 * frecuencia declarada.
 */
export const CAMINATA_METROS = 400;

/**
 * **No se toma prestado `corridor_tolerance_meters`.** Esa es la tolerancia del
 * INSTRUMENTO —a qué distancia del trazado un camión sigue estando en ruta— y
 * usarla como «cuánto camina una persona» acopla dos perillas que significan
 * cosas distintas. Se deja dicho aquí porque es el atajo que se ve razonable.
 */

// ── Lo que entra ─────────────────────────────────────────────────────────

export interface PuntoDelMapa {
  lat: number;
  lon: number;
}

/**
 * Un trazado tal como el teléfono lo tiene.
 *
 * Se nombra `coordenadas` —y no `coordinates`, como `TrazadoDeSentido` del
 * endpoint— porque el llamador es la pantalla y ése es el nombre que ya trae la
 * forma servida. Traducir en el sitio de llamada es una copia más que se puede
 * desalinear.
 *
 * **A resolución completa.** El mismo trazado con el que el endpoint decide qué
 * publicar: a resolución burda corta esquinas, y entonces la proyección cae en
 * el lugar equivocado y el «te sirve» miente por metros que el pasajero camina.
 */
export interface TrazadoParaBuscar {
  sentido: Sentido;
  coordenadas: Array<[number, number]>;
}

// ── Lo que sale ──────────────────────────────────────────────────────────

/** Un extremo del viaje: dónde se sube o se baja, y cuánto camina para llegar. */
export interface ExtremoDelViaje {
  /** El punto pegado al trazado: dónde pasa el camión. */
  lat: number;
  lon: number;
  /** Metros del punto del pasajero al trazado. Lo que camina. */
  caminataMetros: number;
  /** Metros recorridos sobre el trazado hasta aquí. */
  avanceMetros: number;
}

/**
 * Por qué esta ruta no sirve. Nunca un `false` pelado.
 *
 * Un booleano no puede decir «pasa por tu casa pero no por donde vas», y ésa es
 * justo la mitad que el pasajero necesita para entender la respuesta —y para
 * saber si le sirve caminar dos cuadras o si no hay nada que hacer.
 */
export type MotivoDeNoServir =
  /** Ninguno de los dos extremos queda cerca del recorrido. */
  | "los_dos_lejos"
  /** El destino sí queda sobre la ruta; donde está el pasajero, no. */
  | "lejos_de_donde_estas"
  /** El pasajero sí está sobre la ruta; a donde va, no. */
  | "lejos_de_donde_vas"
  /**
   * Los dos quedan cerca, pero el camión pasa primero por el destino: en ese
   * orden no lleva a nadie. Se dice, en vez de callarlo, porque es lo más cerca
   * que esta ruta estuvo de servir y el pasajero merece saberlo.
   */
  | "en_ese_orden_no"
  /**
   * El recorrido a bordo es más corto que lo que ya iba a caminar. Proponer un
   * camión para ochenta metros es una respuesta correcta y tonta.
   */
  | "mejor_camina";

export type ResultadoDeBusqueda =
  | {
      sirve: true;
      sentido: Sentido;
      subir: ExtremoDelViaje;
      bajar: ExtremoDelViaje;
      /** Metros a bordo, sobre el trazado. */
      recorridoMetros: number;
    }
  | {
      sirve: false;
      motivo: MotivoDeNoServir;
      /**
       * Lo medido del intento que más cerca estuvo, para poder decirlo con
       * número: «pasa a 1.2 km de donde vas». `null` cuando no hubo trazado que
       * medir.
       */
      caminataDeDondeEstasMetros: number | null;
      caminataDeDondeVasMetros: number | null;
    };

// ── La medición ──────────────────────────────────────────────────────────

/** Lo que se pudo medir de un sentido. Interno: la pantalla lee el resultado. */
interface IntentoDeSentido {
  sentido: Sentido;
  origen: { caminata: number; avance: number; lat: number; lon: number };
  destino: { caminata: number; avance: number; lat: number; lon: number };
}

/**
 * ¿Este circuito te sirve?
 *
 * Evalúa **cada sentido por su cuenta y se queda con el mejor**, porque ida y
 * vuelta no son espejo: en el circuito 1 miden 20.83 y 16.44 km por los
 * sentidos únicos del Centro, así que un punto puede caer sobre uno y no sobre
 * el otro, y el orden en que el camión los pasa es distinto en cada uno.
 * Invertir un trazado para deducir el otro daría una respuesta que nadie midió.
 */
export function circuitoQueSirve(
  origen: PuntoDelMapa,
  destino: PuntoDelMapa,
  trazados: TrazadoParaBuscar[],
  caminataMetros: number = CAMINATA_METROS,
): ResultadoDeBusqueda {
  const intentos: IntentoDeSentido[] = [];

  for (const t of trazados) {
    const o = proyectarSobreTrazado(origen, t.coordenadas);
    const d = proyectarSobreTrazado(destino, t.coordenadas);
    if (!o || !d) continue; // trazado de menos de dos puntos: no es un recorrido
    intentos.push({
      sentido: t.sentido,
      origen: { caminata: o.distanciaMetros, avance: o.avanceMetros, lat: o.lat, lon: o.lon },
      destino: { caminata: d.distanciaMetros, avance: d.avanceMetros, lat: d.lat, lon: d.lon },
    });
  }

  if (intentos.length === 0) {
    return {
      sirve: false,
      motivo: "los_dos_lejos",
      caminataDeDondeEstasMetros: null,
      caminataDeDondeVasMetros: null,
    };
  }

  /*
   * Los que sirven de verdad: los dos extremos alcanzables A PIE y el destino
   * por delante. El orden es la mitad de la pregunta — un trazado que pasa
   * cerca de los dos puntos en el sentido contrario no lleva a nadie.
   */
  const sirven = intentos.filter(
    (i) =>
      i.origen.caminata <= caminataMetros &&
      i.destino.caminata <= caminataMetros &&
      i.destino.avance > i.origen.avance,
  );

  if (sirven.length > 0) {
    /*
     * Con más de uno, gana el recorrido a bordo más corto.
     *
     * Pasa en un circuito que cierra, donde los dos sentidos pueden llevar del
     * mismo A al mismo B — uno dando la vuelta entera. No es una decisión de
     * ruteo: es no proponerle al pasajero los dieciocho kilómetros cuando los
     * mismos dos puntos están a dos por el otro lado.
     */
    const mejor = sirven
      .map((i) => ({ i, recorrido: i.destino.avance - i.origen.avance }))
      .sort((a, b) => a.recorrido - b.recorrido)[0];

    if (mejor.recorrido <= caminataMetros) {
      return {
        sirve: false,
        motivo: "mejor_camina",
        caminataDeDondeEstasMetros: mejor.i.origen.caminata,
        caminataDeDondeVasMetros: mejor.i.destino.caminata,
      };
    }

    return {
      sirve: true,
      sentido: mejor.i.sentido,
      subir: {
        lat: mejor.i.origen.lat,
        lon: mejor.i.origen.lon,
        caminataMetros: mejor.i.origen.caminata,
        avanceMetros: mejor.i.origen.avance,
      },
      bajar: {
        lat: mejor.i.destino.lat,
        lon: mejor.i.destino.lon,
        caminataMetros: mejor.i.destino.caminata,
        avanceMetros: mejor.i.destino.avance,
      },
      recorridoMetros: mejor.recorrido,
    };
  }

  /*
   * Ninguno sirvió. Se reporta **el intento que más cerca estuvo**, no el
   * primero de la lista: de los dos sentidos, el que menos le falta es el que
   * le dice algo útil al pasajero.
   *
   * «En ese orden no» va antes que cualquier falla de distancia porque afirma
   * más y es más específico: los dos puntos SÍ están sobre la ruta, y eso ya lo
   * midió el sistema. Degradarlo a «queda lejos» sería decir menos de lo que se
   * sabe.
   */
  const enOrdenInvertido = intentos.filter(
    (i) => i.origen.caminata <= caminataMetros && i.destino.caminata <= caminataMetros,
  );

  if (enOrdenInvertido.length > 0) {
    const i = enOrdenInvertido[0];
    return {
      sirve: false,
      motivo: "en_ese_orden_no",
      caminataDeDondeEstasMetros: i.origen.caminata,
      caminataDeDondeVasMetros: i.destino.caminata,
    };
  }

  /* Lo que falta es distancia. Gana el que menos camina en total. */
  const masCerca = [...intentos].sort(
    (a, b) =>
      a.origen.caminata + a.destino.caminata - (b.origen.caminata + b.destino.caminata),
  )[0];

  const origenCerca = masCerca.origen.caminata <= caminataMetros;
  const destinoCerca = masCerca.destino.caminata <= caminataMetros;

  return {
    sirve: false,
    motivo: origenCerca
      ? "lejos_de_donde_vas"
      : destinoCerca
        ? "lejos_de_donde_estas"
        : "los_dos_lejos",
    caminataDeDondeEstasMetros: masCerca.origen.caminata,
    caminataDeDondeVasMetros: masCerca.destino.caminata,
  };
}

// ── El tramo que se va a bordo ───────────────────────────────────────────

/**
 * El pedazo del trazado entre dos avances: **exactamente lo que el pasajero va
 * a bordo**, para que el mapa lo pueda pintar encima del recorrido completo.
 *
 * Está aquí y no en la pantalla porque es geometría, y porque se corta contra
 * los mismos avances que ya midió `circuitoQueSirve`. Recalcularlo en el
 * componente sería una segunda medición del mismo viaje, y dos mediciones del
 * mismo viaje se separan.
 *
 * **No se dibuja nada que el recorrido no recorra.** Los dos extremos son los
 * puntos pegados —interpolados sobre el segmento donde caen, no el vértice más
 * cercano—, y entre ellos van los vértices reales del trazado. Ninguna recta
 * atraviesa por fuera: es la §E del Marco aplicada a una línea, la misma razón
 * por la que la traza del Workbench se corta en los huecos de señal en vez de
 * cruzarlos.
 *
 * Devuelve `[]` cuando el rango no tiene largo o el trazado no es un recorrido.
 */
export function tramoDelTrazado(
  coordenadas: Array<[number, number]>,
  desdeMetros: number,
  hastaMetros: number,
): Array<[number, number]> {
  if (coordenadas.length < 2 || hastaMetros <= desdeMetros) return [];

  const interpolar = (
    a: [number, number],
    b: [number, number],
    fraccion: number,
  ): [number, number] => [a[0] + (b[0] - a[0]) * fraccion, a[1] + (b[1] - a[1]) * fraccion];

  const salida: Array<[number, number]> = [];
  let acumulado = 0;

  for (let i = 0; i < coordenadas.length - 1; i++) {
    const a = coordenadas[i];
    const b = coordenadas[i + 1];
    const largo = metrosEntre({ lat: a[1], lon: a[0] }, { lat: b[1], lon: b[0] });
    const inicio = acumulado;
    const fin = acumulado + largo;

    if (fin >= desdeMetros && inicio <= hastaMetros) {
      /* El primer punto es el extremo pegado, no el vértice de antes. */
      if (salida.length === 0) {
        const f = largo === 0 ? 0 : Math.max(0, Math.min(1, (desdeMetros - inicio) / largo));
        salida.push(interpolar(a, b, f));
      }
      if (fin <= hastaMetros) {
        salida.push(b);
      } else {
        const f = largo === 0 ? 0 : Math.max(0, Math.min(1, (hastaMetros - inicio) / largo));
        salida.push(interpolar(a, b, f));
        break;
      }
    }

    acumulado = fin;
  }

  return salida.length >= 2 ? salida : [];
}
