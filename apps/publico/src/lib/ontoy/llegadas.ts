"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  avanceSobreTrazado,
  paradasHasta,
  permisoDeRango,
  rangoDeLlegada,
  velocidadDelCorredor,
  type MuestraDeAvance,
  type RangoDeLlegada,
} from "@jtel/domain";
import type { Forma, PromesaAhora, Sentido, Vivo } from "./forma";

/**
 * Las llegadas — **todo el cálculo de Ontoy, en un solo lugar.**
 *
 * Lo usan la vista de Rutas (el atajo de la parada guardada) y la hoja de una
 * parada del mapa. Las dos preguntan lo mismo —«¿cuándo llega la siguiente
 * aquí?»— y si cada una lo calculara por su cuenta, un día dirían minutos
 * distintos de la misma parada en la misma pantalla.
 *
 * ## Nada de esto se inventa
 *
 * La aritmética vive en `@jtel/domain` y no se reimplementa: `permisoDeRango`
 * resuelve **las dos condiciones** que autorizan decir un minuto (el
 * interruptor del circuito y la frescura de ESA posición), y sin permiso no hay
 * minuto. La velocidad sale de lo que las unidades avanzaron de verdad entre
 * sondeos, y cuando no hay muestras suficientes cae a la declarada, diciendo
 * cuál usó.
 *
 * ## Y nada de esto sale del teléfono
 *
 * La ubicación del pasajero entra aquí como argumento y se queda aquí (8.3b).
 * La única petición de esta app pide unidades por circuito; ninguna lleva
 * coordenadas.
 */

/** Ventana corta: el tráfico de hace media hora no dice nada del de ahora. */
const MUESTRAS_MAXIMAS = 12;

/**
 * La velocidad del corredor, medida entre sondeos.
 *
 * Sólo cuenta el avance **hacia adelante**: un retroceso es ruido del GPS, no
 * un camión en reversa por la avenida.
 */
export function useVelocidadDelCorredor(forma: Forma | null, vivo: Vivo | null) {
  const [muestras, setMuestras] = useState<MuestraDeAvance[]>([]);
  const anteriores = useRef(new Map<string, { avance: number; en: number }>());

  const trazadoPorSentido = useMemo(() => {
    const m = new Map<Sentido, Array<[number, number]>>();
    for (const t of forma?.trazados ?? []) m.set(t.sentido, t.coordenadas);
    return m;
  }, [forma]);

  useEffect(() => {
    if (!vivo || !forma) return;
    const ahora = Date.now();
    const nuevas: MuestraDeAvance[] = [];
    for (const u of vivo.unidades) {
      if (!u.sentido) continue;
      const trazado = trazadoPorSentido.get(u.sentido);
      if (!trazado) continue;
      const a = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, forma.corredor_m);
      if (!a) continue;
      const antes = anteriores.current.get(u.economico);
      if (antes) {
        const metros = a.avanceMetros - antes.avance;
        if (metros > 0) nuevas.push({ metros, segundos: (ahora - antes.en) / 1000 });
      }
      anteriores.current.set(u.economico, { avance: a.avanceMetros, en: ahora });
    }
    if (nuevas.length) setMuestras((p) => [...p, ...nuevas].slice(-MUESTRAS_MAXIMAS));
  }, [vivo, forma, trazadoPorSentido]);

  const velocidad = useMemo(
    () => velocidadDelCorredor(forma?.velocidad_declarada_kmh ?? 0, muestras),
    [forma, muestras],
  );

  return { velocidad, trazadoPorSentido };
}

export interface LlegadaCalculada {
  rango: RangoDeLlegada;
  unidad: string;
  /** La edad de la posición con que se calculó. El skill: todo dato vivo trae su edad. */
  antiguedadSeg: number;
}

/**
 * Cuánto falta para que las unidades lleguen a UN punto del corredor.
 *
 * `destino` es una abscisa sobre el trazado de ese sentido: la de una parada, o
 * la del pasajero cuando está sobre el corredor (8.3b). Las dos preguntas son
 * la misma cuenta, y por eso es una sola función.
 *
 * Devuelve la lista ordenada por cercanía. **Vacía no es «no hay servicio»**:
 * puede ser que ninguna unidad tenga permiso de rango, y quien la lee tiene que
 * decirlo con la escalera, no con un cero.
 */
export function llegadasHasta(
  destino: { avanceMetros: number; sentido: Sentido },
  entrada: {
    forma: Forma;
    vivo: Vivo;
    velocidadKmh: number;
    trazadoPorSentido: Map<Sentido, Array<[number, number]>>;
  },
): LlegadaCalculada[] {
  const { forma, vivo, velocidadKmh, trazadoPorSentido } = entrada;
  const salida: LlegadaCalculada[] = [];

  for (const u of vivo.unidades) {
    // Sin sentido no se sabe si viene o va.
    if (u.sentido !== destino.sentido) continue;
    /*
     * El permiso resuelve de una vez el interruptor del circuito y la frescura
     * de ESTA posición. Dos comprobaciones separadas y lejos una de otra es lo
     * que ya dejó una vez a la lista de paradas sin ninguna de las dos.
     */
    const permiso = permisoDeRango({
      rangoActivo: vivo.rango_activo,
      posicionFresca: u.fresco,
      velocidadKmh,
      pisoSegundos: forma.piso_rango_seg,
    });
    if (!permiso) continue;

    const trazado = trazadoPorSentido.get(u.sentido);
    if (!trazado) continue;
    const donde = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, forma.corredor_m);
    if (!donde) continue;

    const r = rangoDeLlegada(donde.avanceMetros, destino.avanceMetros, permiso);
    if (r) salida.push({ rango: r, unidad: u.economico, antiguedadSeg: u.antiguedad_seg });
  }

  return salida.sort((a, b) => a.rango.estimadoSeg - b.rango.estimadoSeg);
}

/** La abscisa de una parada sobre el trazado de un sentido. `null` si no cae en él. */
export function dondeCaeLaParada(
  parada: { lat: number; lon: number },
  trazado: Array<[number, number]> | undefined,
  corredorMetros: number,
): number | null {
  if (!trazado) return null;
  return avanceSobreTrazado(parada, trazado, corredorMetros)?.avanceMetros ?? null;
}

/** Una unidad contada en paradas (8.9b). */
export interface ParadasDeUnaUnidad {
  /** Las que le faltan hasta la del pasajero, incluida la suya. Nunca 0. */
  paradas: number;
  unidad: string;
  antiguedadSeg: number;
  /**
   * Si su posición es de ahorita. Una vieja **también se cuenta**, pero se dice
   * en pasado —«iba a 4 paradas»— y sin número grande: es lo último que se vio,
   * no dónde está (8.9, decisión de ASAV del 22-sep).
   */
  fresca: boolean;
}

/**
 * **«A N paradas»** — lo que la app dice mientras la velocidad del corredor no
 * está calibrada (8.9b). Sale sólo de la posición real de cada unidad y del
 * orden de las paradas sobre el trazado: **ninguna velocidad entra aquí**, así
 * que no hay llegada inventada.
 *
 * Mismas reglas que los minutos: sólo unidades de ESE sentido, dentro del
 * corredor, que todavía no pasan la parada. Las paradas que cuentan son las de
 * ese sentido o de los dos, y sólo las que caen en el trazado.
 *
 * Primero las frescas, de la más cercana a la más lejana; luego las viejas.
 */
export function paradasHastaLaParada(
  destino: { avanceMetros: number; sentido: Sentido },
  entrada: {
    forma: Forma;
    vivo: Vivo;
    trazadoPorSentido: Map<Sentido, Array<[number, number]>>;
  },
): ParadasDeUnaUnidad[] {
  const { forma, vivo, trazadoPorSentido } = entrada;
  const trazado = trazadoPorSentido.get(destino.sentido);
  if (!trazado) return [];

  const abscisas = forma.paradas
    .filter((p) => p.sentido === null || p.sentido === destino.sentido)
    .map((p) => dondeCaeLaParada(p, trazado, forma.corredor_m))
    .filter((a): a is number => a !== null);

  const salida: ParadasDeUnaUnidad[] = [];
  for (const u of vivo.unidades) {
    // Sin sentido no se sabe si viene o va.
    if (u.sentido !== destino.sentido) continue;
    const donde = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, forma.corredor_m);
    if (!donde) continue;
    const n = paradasHasta(donde.avanceMetros, destino.avanceMetros, abscisas);
    if (n !== null) salida.push({ paradas: n, unidad: u.economico, antiguedadSeg: u.antiguedad_seg, fresca: u.fresco });
  }

  return salida.sort((a, b) => Number(b.fresca) - Number(a.fresca) || a.paradas - b.paradas);
}

/** «a 1 parada», «a 3 paradas». La cuenta pareja: nunca «llegando». */
export function paradasEnPalabras(n: number): string {
  return n === 1 ? "a 1 parada" : `a ${n} paradas`;
}

/** Un rango en palabras: «4–7 min». Nunca un número solo — sin su rango, miente. */
export function rangoEnPalabras(r: RangoDeLlegada): string {
  const min = (s: number) => Math.max(0, Math.round(s / 60));
  const a = min(r.desdeSeg);
  const b = min(r.hastaSeg);
  if (a === b) return `${a} min`;
  return `${a}–${b} min`;
}

// La frase vive en el dominio (una sola, la misma que enseña J-Staff); aquí se reexporta.
export { promesaEnPalabras } from "@jtel/domain";

// ── Las próximas paradas de UNA unidad (tocar a Cami) ────────────────────

/** Una parada por delante de la unidad, contada desde donde va. */
export interface ParadaPorDelante {
  id: string;
  nombre: string;
  /** Cuántas paradas le faltan a la unidad para llegar a ésta. Nunca 0. */
  paradas: number;
}

/**
 * **Las próximas paradas de una unidad** — lo que contesta tocar a Cami.
 *
 * Es la inversa de `paradasHastaLaParada`: aquélla parte de la parada del
 * pasajero y cuenta unidades; ésta parte de la unidad y cuenta paradas. Se
 * escribe aparte en vez de generalizar la otra porque las dos preguntas tienen
 * **reglas distintas de qué se descarta**, y una función con una bandera para
 * cambiarlas es la forma de que un día se descarte lo que no era.
 *
 * Las reglas, que son las mismas de siempre:
 *
 *  - **Sólo paradas de SU sentido** (o de los dos). Mezclarlas sería enseñarle
 *    al pasajero paradas por las que este camión no va a pasar.
 *  - **Sólo las que caen en el trazado**, con el mismo corredor con el que el
 *    servidor decidió qué publicar.
 *  - **Sólo las que van por delante.** Una parada que ya quedó atrás no es una
 *    próxima parada, y ponerla ahí invitaría a alguien a caminar hacia ella.
 *  - **Ninguna velocidad entra aquí** (8.9b): esto cuenta paradas, no minutos,
 *    así que no hay llegada inventada ni hace falta permiso de rango.
 *
 * **Una unidad con dato viejo también contesta**, porque el camión no se fue a
 * ningún lado — pero quien la dibuje tiene que decirlo en pasado y sin cifra
 * grande (8.9). Esta función no lo sabe: entrega la cuenta y la pantalla pone
 * el tiempo verbal.
 *
 * ## Qué NO hace
 *
 * **No dice cuándo llega a ninguna de ellas.** Ni aquí ni en la pantalla: sin
 * el corredor calibrado no hay minuto que dar, y «a N paradas» es exactamente
 * lo que se puede sostener.
 *
 * **No inventa la parada de la que viene.** Si la unidad no cae en el trazado
 * —fuera del corredor— devuelve la lista vacía, y la hoja lo dice en vez de
 * enseñar las paradas de la ruta como si fueran las suyas.
 */
export function proximasParadasDeLaUnidad(
  unidad: { lat: number; lon: number; sentido: Sentido | null },
  entrada: { forma: Forma; trazadoPorSentido: Map<Sentido, Array<[number, number]>> },
  cuantas = 4,
): ParadaPorDelante[] {
  const { forma, trazadoPorSentido } = entrada;
  if (!unidad.sentido) return [];
  const trazado = trazadoPorSentido.get(unidad.sentido);
  if (!trazado) return [];

  const donde = avanceSobreTrazado({ lat: unidad.lat, lon: unidad.lon }, trazado, forma.corredor_m);
  if (!donde) return [];

  const conAbscisa = forma.paradas
    .filter((p) => p.sentido === null || p.sentido === unidad.sentido)
    .map((p) => ({ p, a: dondeCaeLaParada(p, trazado, forma.corredor_m) }))
    .filter((x): x is { p: (typeof forma.paradas)[number]; a: number } => x.a !== null)
    .filter((x) => x.a > donde.avanceMetros)
    .sort((x, y) => x.a - y.a);

  /*
   * La cuenta es **la posición en la fila**, no una distancia: la primera que
   * tiene por delante es «a 1 parada», la siguiente «a 2». Contar con
   * `paradasHasta` daría lo mismo aquí y costaría una pasada por cada parada,
   * porque la lista ya viene ordenada por avance.
   */
  return conAbscisa.slice(0, cuantas).map(({ p }, i) => ({ id: p.id, nombre: p.nombre, paradas: i + 1 }));
}
