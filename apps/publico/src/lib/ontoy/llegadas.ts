"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  avanceSobreTrazado,
  permisoDeRango,
  rangoDeLlegada,
  velocidadDelCorredor,
  type MuestraDeAvance,
  type RangoDeLlegada,
} from "@jtel/domain";
import type { Forma, Sentido, Vivo } from "./forma";

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
     * que ya dejó una vez al hilo de paradas sin ninguna de las dos.
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

/** Un rango en palabras: «4–7 min». Nunca un número solo — sin su rango, miente. */
export function rangoEnPalabras(r: RangoDeLlegada): string {
  const min = (s: number) => Math.max(0, Math.round(s / 60));
  const a = min(r.desdeSeg);
  const b = min(r.hastaSeg);
  if (a === b) return `${a} min`;
  return `${a}–${b} min`;
}

/**
 * La promesa publicada, en palabras. **Se enseña siempre** (8.2), aunque no
 * haya una sola unidad en vivo: vale por sí sola, como el horario del poste.
 *
 * Sin frecuencia declarada **no se inventa una cadencia**: se dice que la ruta
 * no la publicó. Es la diferencia entre una promesa y una suposición.
 */
export function promesaEnPalabras(frecuenciaMin: number | null): string {
  return frecuenciaMin === null
    ? "Esta ruta no publica cada cuánto pasa"
    : `Frecuencia · cada ${frecuenciaMin} min`;
}
