import {
  SIN_SENAL_MINUTOS,
  hayHuecoEntre,
  huecosDeSenal,
  ordenarPorTiempo,
  partirEnHuecos,
  type GeofenceRole,
  type Hueco,
  type PuntoTraza,
  type Ventana,
} from "@jtel/domain";
import { pointInPolygon } from "@jtel/verification";
import { kilometrosSinSaltos } from "./recorrido.js";

/**
 * El recorrido de una unidad en una ventana de tiempo — C1/C3 del cuarto de
 * Compás, lógica sin pantalla.
 *
 * Es lo que C3 pinta en Ver ‹unidad› con su playback: los tramos observados,
 * los huecos entre ellos, las visitas a lugares («salió de la base 05:30»,
 * «llegó a Planta 47 06:08») y las cifras del periodo. Función pura: quien
 * llama trae los puntos y las geocercas que la unidad puede visitar; el día es
 * sólo el caso donde la ventana es una medianoche a la siguiente
 * (`ventanaDelDia`) — la regla y los umbrales son los mismos para cualquier
 * ventana, incluida una que cruce medianoche (turno nocturno) o dure minutos
 * (la brocha del playback acotando).
 *
 * **El corte de la traza va aparte, encima de las visitas** (`cortarPorModalidad`),
 * porque depende de algo que el recorrido no sabe: la modalidad del servicio
 * que la unidad daba en ese momento (Marco, Pieza 7). Todo lo demás de este
 * módulo es igual para especial y para circuito.
 */

/**
 * Una geocerca vista como lugar: dónde está y qué papel juega.
 *
 * Hoy los roles son los del enum de la base (destino, base, caseta, otro).
 * Cuando existan patio y taller, entran aquí sin cambiar la forma.
 */
export type Lugar = {
  id: string;
  nombre: string;
  rol: GeofenceRole;
  poligono: Array<{ lat: number; lng: number }>;
};

/**
 * **La pregunta de lugar: ¿en qué lugares está este punto?**
 *
 * Es una sola función a propósito, porque la van a hacer dos preguntas
 * distintas y no pueden contestar distinto:
 *
 *   1. El corte de la traza (`cortarPorModalidad`): ¿entró a un destino?
 *   2. El estado de la unidad (cuando existan Lugares y el mapa en vivo):
 *      «desconectado» se parte según dónde quedó — en el patio está
 *      descansando, en el taller está fuera de servicio, en ruta está en
 *      servicio, y sólo fuera de todo lugar está desconectado de verdad. Como
 *      «en bodega» para un dispositivo: el sistema no adivina, pero no pide que
 *      le repitan lo que ya puede saber.
 *
 * **Usa el `pointInPolygon` del motor, no una copia.** La llegada que se lea
 * aquí tiene que ser la misma que el árbitro selló: un punto en el borde que
 * una copia cuenta adentro y el motor afuera sería justo la lectura cruda
 * contradiciendo al hecho sellado (Marco §E). La copia de `map-evidence.ts`
 * ya difiere del motor en un épsilon.
 *
 * Puede devolver más de uno: las geocercas pueden encimarse.
 */
export function lugaresDelPunto(punto: { lat: number; lng: number }, lugares: Lugar[]): Lugar[] {
  return lugares.filter((l) => pointInPolygon(punto, l.poligono));
}

/**
 * Una estancia observada dentro de un lugar.
 *
 * Las horas son de puntos medidos, nunca interpoladas: «llegó 06:08» es la hora
 * del primer punto adentro — la misma regla con la que el motor encuentra la
 * entrada a la geocerca.
 */
export type Visita = {
  lugar: Lugar;
  /** Primer punto medido adentro. */
  entrada: Date;
  /**
   * Si se vio entrar: el punto anterior, sin hueco de por medio, estaba afuera.
   * Si no —el día empezó adentro, o reapareció adentro después de un hueco—
   * la pantalla no puede decir «llegó a las …»: sólo «adentro desde …».
   */
  entradaObservada: boolean;
  /** Último punto medido adentro. */
  ultimoAdentro: Date;
  /**
   * Primer punto medido afuera, sin hueco de por medio. `null` si no se vio
   * salir: el día terminó adentro o la señal se perdió adentro.
   */
  salida: Date | null;
};

export type CifrasDelPeriodo = {
  puntos: number;
  /** Sólo dentro de los tramos: lo que pasó dentro de un hueco no se midió. */
  kmMedidos: number;
  saltosDescartados: number;
  /** Suma de lo que duró cada tramo observado. */
  minutosConSenal: number;
  huecos: number;
};

export type RecorridoPorVentana = {
  tramos: PuntoTraza[][];
  huecos: Hueco[];
  visitas: Visita[];
  cifras: CifrasDelPeriodo;
};

/**
 * Visitas a lugares a lo largo de la traza.
 *
 * **Un hueco parte la visita**, igual que parte la traza y la parada (Marco §E):
 * si la unidad estaba adentro antes y después de 40 minutos sin señal, no se
 * sabe si se quedó. Salen dos visitas; la primera sin salida y la segunda sin
 * entrada observada.
 */
export function visitasALugares(
  puntos: PuntoTraza[],
  lugares: Lugar[],
  umbralHuecoMinutos: number = SIN_SENAL_MINUTOS,
): Visita[] {
  const ordenados = ordenarPorTiempo(puntos);
  const visitas: Visita[] = [];
  if (ordenados.length === 0 || lugares.length === 0) return visitas;

  // Qué lugares contiene cada punto, calculado una vez.
  const adentro = ordenados.map((p) => new Set(lugaresDelPunto(p, lugares).map((l) => l.id)));

  for (const lugar of lugares) {
    let abierta: Visita | null = null;
    for (let i = 0; i < ordenados.length; i += 1) {
      const p = ordenados[i]!;
      const previo = i > 0 ? ordenados[i - 1]! : null;
      const continuo = previo !== null && !hayHuecoEntre(previo, p, umbralHuecoMinutos);
      const estaAdentro = adentro[i]!.has(lugar.id);

      if (abierta && !continuo) {
        // Se perdió la señal adentro: no se vio salir.
        visitas.push(abierta);
        abierta = null;
      }
      if (estaAdentro) {
        if (abierta) abierta.ultimoAdentro = p.at;
        else
          abierta = {
            lugar,
            entrada: p.at,
            entradaObservada: continuo && !adentro[i - 1]!.has(lugar.id),
            ultimoAdentro: p.at,
            salida: null,
          };
      } else if (abierta) {
        abierta.salida = p.at;
        visitas.push(abierta);
        abierta = null;
      }
    }
    if (abierta) visitas.push(abierta);
  }

  return visitas.sort((a, b) => a.entrada.getTime() - b.entrada.getTime());
}

/**
 * El recorrido en una ventana: tramos, huecos, visitas y cifras.
 *
 * **`ventana` acota lo que se reporta, no lo que hay que traer.** Quien llama
 * puede pasar puntos de más (por ejemplo, con margen para que un hueco que
 * empieza justo antes de la ventana se calcule bien más adelante); esta
 * función descarta lo que cae fuera de `[ventana.desde, ventana.hasta]`
 * (los dos extremos incluidos) antes de partir tramos, huecos y visitas. El
 * día es sólo la ventana que arma `ventanaDelDia`: misma regla, sin caso
 * especial para la medianoche.
 */
export function recorridoPorVentana(entrada: {
  ventana: Ventana;
  puntos: PuntoTraza[];
  lugares: Lugar[];
  umbralHuecoMinutos?: number;
}): RecorridoPorVentana {
  const umbral = entrada.umbralHuecoMinutos ?? SIN_SENAL_MINUTOS;
  const desde = entrada.ventana.desde.getTime();
  const hasta = entrada.ventana.hasta.getTime();
  const puntos = ordenarPorTiempo(entrada.puntos).filter((q) => {
    const t = q.at.getTime();
    return t >= desde && t <= hasta;
  });
  const tramos = partirEnHuecos(puntos, umbral);
  const huecos = huecosDeSenal(puntos, umbral);

  let kmMedidos = 0;
  let saltosDescartados = 0;
  let minutosConSenal = 0;
  for (const tramo of tramos) {
    const { km, saltos } = kilometrosSinSaltos(
      tramo.map((p) => ({ recordedAt: p.at, latitude: p.lat, longitude: p.lng })),
    );
    kmMedidos += km;
    saltosDescartados += saltos;
    minutosConSenal += (tramo[tramo.length - 1]!.at.getTime() - tramo[0]!.at.getTime()) / 60_000;
  }

  return {
    tramos,
    huecos,
    visitas: visitasALugares(puntos, entrada.lugares, umbral),
    cifras: {
      puntos: puntos.length,
      kmMedidos,
      saltosDescartados,
      minutosConSenal,
      huecos: huecos.length,
    },
  };
}

/**
 * La modalidad del servicio (Marco 7.1): especial, con inicio, fin y sello; o
 * circuito, con paradas y sin sello.
 */
export type Modalidad = "especial" | "circuito";

/** Un intervalo donde la traza no se dibuja: la unidad estaba adentro de un destino. */
export type TrazaOculta = {
  lugar: Lugar;
  /** Primer punto adentro: «llegó» si `entradaObservada`, si no «adentro desde». */
  desde: Date;
  entradaObservada: boolean;
  /** Primer punto afuera («salió»), o el último adentro si no se vio salir. */
  hasta: Date;
  salidaObservada: boolean;
};

export type TrazaCortada = {
  /** Lo que se dibuja: los tramos observados, partidos además en cada corte. */
  tramos: PuntoTraza[][];
  /** Lo que no se dibuja, con sus horas, para que la pantalla y el playback lo digan. */
  ocultos: TrazaOculta[];
};

/**
 * Corta la traza según la modalidad (Marco 7.4).
 *
 * La traza se corta para que la lectura cruda no contradiga un hecho sellado.
 * Por eso:
 *
 *   · **especial** — al llegar a una geocerca de rol **destino** la traza se
 *     corta: queda la línea hasta el primer punto adentro («llegó 06:08»),
 *     adentro no se dibuja nada, y sigue desde el primer punto afuera
 *     («salió 06:52»).
 *   · **circuito** — no hay sello que proteger: la traza no se corta, aunque
 *     cruce esa misma geocerca (7.6).
 *
 * Base, caseta y otro no cortan en ninguna modalidad (decisión 1 del cuarto).
 *
 * **La modalidad entra como dato; no se adivina** (7.5). `modalidadEn` contesta
 * «¿qué servicio daba la unidad en este instante?» y se consulta en la hora de
 * entrada de cada visita: es la misma unidad en la misma geocerca la que en la
 * mañana corta (turno a Planta 47) y en la tarde no (circuito). De dónde sale
 * esa respuesta en los datos está abierto (7.7) y no se decide aquí.
 *
 * Si no se vio entrar (el día empezó adentro, o reapareció adentro tras un
 * hueco), no hay punto de llegada que conservar: se oculta todo lo de adentro.
 */
export function cortarPorModalidad(
  recorrido: Pick<RecorridoPorVentana, "tramos" | "visitas">,
  modalidadEn: (instante: Date) => Modalidad,
): TrazaCortada {
  const queCortan = recorrido.visitas.filter(
    (v) => v.lugar.rol === "destino" && modalidadEn(v.entrada) === "especial",
  );
  const ocultos: TrazaOculta[] = queCortan.map((v) => ({
    lugar: v.lugar,
    desde: v.entrada,
    entradaObservada: v.entradaObservada,
    hasta: v.salida ?? v.ultimoAdentro,
    salidaObservada: v.salida !== null,
  }));

  if (ocultos.length === 0) return { tramos: recorrido.tramos, ocultos };

  // Un punto se oculta si cae adentro de una visita que corta. El de entrada se
  // conserva sólo si se vio entrar: es el punto sobre la cerca donde termina la
  // línea. El de salida ya está afuera y abre el tramo siguiente.
  const oculto = (p: PuntoTraza) => {
    const t = p.at.getTime();
    return queCortan.some((v) => {
      const desde = v.entrada.getTime();
      const hasta = v.ultimoAdentro.getTime();
      return v.entradaObservada ? t > desde && t <= hasta : t >= desde && t <= hasta;
    });
  };

  const tramos: PuntoTraza[][] = [];
  for (const tramo of recorrido.tramos) {
    let actual: PuntoTraza[] = [];
    for (const p of tramo) {
      if (oculto(p)) {
        if (actual.length > 0) tramos.push(actual);
        actual = [];
      } else {
        actual.push(p);
      }
    }
    if (actual.length > 0) tramos.push(actual);
  }

  return { tramos, ocultos };
}
