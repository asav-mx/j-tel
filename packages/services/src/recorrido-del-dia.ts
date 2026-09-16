import {
  SIN_SENAL_MINUTOS,
  hayHuecoEntre,
  huecosDeSenal,
  ordenarPorTiempo,
  partirEnHuecos,
  type GeofenceRole,
  type Hueco,
  type PuntoTraza,
} from "@jtel/domain";
import { pointInPolygon } from "@jtel/verification";
import { kilometrosSinSaltos } from "./recorrido.js";

/**
 * El recorrido de una unidad en un día — C1 del cuarto de Compás, lógica sin
 * pantalla.
 *
 * Es lo que C3 va a pintar en Ver ‹unidad› con su playback: los tramos
 * observados, los huecos entre ellos, las visitas a lugares («salió de la base
 * 05:30», «llegó a Planta 47 06:08») y las cifras del día. Función pura: quien
 * llama trae los puntos del día y las geocercas que la unidad puede visitar.
 *
 * **Lo que todavía NO hace, a propósito: cortar la traza.** Qué se corta
 * depende de la modalidad del servicio que la unidad está dando en ese tramo:
 * en especial (con sello) la geocerca de destino corta, para que la lectura
 * cruda no contradiga la llegada sellada; en circuito (sin sello) la unidad
 * pasa por paradas y la traza sigue. La modalidad todavía no existe como dato y
 * el Marco dice hoy «sin excepción»; la enmienda está en camino. Cuando entre,
 * el corte es una función encima de `visitas`: recibe «¿este tramo es especial
 * o circuito?» como entrada, no lo adivina. Todo lo de aquí abajo es igual para
 * las dos modalidades.
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
 *   1. El corte de la traza (cuando llegue la modalidad): ¿entró a un destino?
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

export type CifrasDelDia = {
  puntos: number;
  /** Sólo dentro de los tramos: lo que pasó dentro de un hueco no se midió. */
  kmMedidos: number;
  saltosDescartados: number;
  /** Suma de lo que duró cada tramo observado. */
  minutosConSenal: number;
  huecos: number;
};

export type RecorridoDelDia = {
  tramos: PuntoTraza[][];
  huecos: Hueco[];
  visitas: Visita[];
  cifras: CifrasDelDia;
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

/** El recorrido de un día: tramos, huecos, visitas y cifras. */
export function recorridoDelDia(entrada: {
  puntos: PuntoTraza[];
  lugares: Lugar[];
  umbralHuecoMinutos?: number;
}): RecorridoDelDia {
  const umbral = entrada.umbralHuecoMinutos ?? SIN_SENAL_MINUTOS;
  const puntos = ordenarPorTiempo(entrada.puntos);
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
