import type { Sentido } from "./publico.js";

/**
 * **El recorrido por tramo, agregado** (Marco 8.16, regla 5; Ontoy 2.0, PR 5).
 *
 * Cuánto tarda un camión de un circuito en ir de una parada a la siguiente, del
 * circuito y **agregado** — nunca por transportista ni por unidad. Es lo que el
 * planeador necesita para poder dar un total, y lo único de la medición que se
 * publica: la comparación entre transportistas sigue en el cajón reservado
 * (9.14).
 *
 * ## Función pura, y por eso no sabe de dónde salen los pasos
 *
 * Recibe pasos ya leídos y devuelve el agregado. No consulta nada: quién puede
 * leer los pasos crudos, y con qué muro, es asunto de quien la llama. Así esta
 * aritmética se prueba sin base y sirve igual desde un cron que desde cualquier
 * otro lado.
 *
 * ## Un tramo es un RANGO, porque un paso lo es
 *
 * El detector no guarda un instante: guarda los dos pings que encierran el
 * cruce. Así que de un paso a otro sólo se puede afirmar un rango:
 *
 * - **lo menos que pudo tardar:** del final del primer paso al principio del
 *   segundo;
 * - **lo más:** del principio del primero al final del segundo.
 *
 * Publicar un solo número sería inventarle precisión al instrumento.
 *
 * ## Qué se descarta, y por qué
 *
 * - **Dos paradas que no son consecutivas.** Si el detector se saltó una, el
 *   salto mide dos tramos y no uno. Se pide que el orden sea `n` → `n+1`.
 * - **Travesías absurdamente largas.** Entre dos paradas, más de una hora no es
 *   un tramo: es un hueco del instrumento, una unidad que se apagó y volvió, o
 *   una vuelta entera. Arrastraría la mediana de todos.
 * - **Pasos repetidos.** El detector puede correr dos veces sobre los mismos
 *   días —a propósito: sus corridas se apilan, no se pisan—, y el mismo cruce
 *   contado dos veces inflaría el número de travesías.
 * - **Tramos con pocas travesías.** Con menos de `MINIMO_TRAVESIAS` no se
 *   publica nada: un solo camión atorado movería el número, y la app dice «se
 *   está midiendo» en vez de dar un total falso (8.16, regla 4).
 */

/** Un paso detectado, en la forma mínima que esta aritmética necesita. */
export interface PasoDeUnaUnidad {
  /** Identificador de la unidad — sólo para encadenar sus pasos; NO sale en el agregado. */
  unidad: string;
  sentido: Sentido;
  /** La parada, por su identificador público. */
  parada: string;
  /** Su lugar en el orden del sentido: un tramo es `n` → `n+1`. */
  orden: number;
  /** Los dos pings que encierran el cruce. */
  desde: Date;
  hasta: Date;
}

/**
 * El tramo tal como se PUBLICA. Distinto de `TramoMedido` de
 * `ritmo-prometido.ts`, que son las muestras crudas de un tránsito para el
 * perfil de la vuelta en la torre: eso es de la casa, esto es del pasajero.
 */
export interface TramoPublicado {
  sentido: Sentido;
  de: string;
  a: string;
  /** Cuántas travesías se midieron en la ventana. Es lo que sostiene el número. */
  travesias: number;
  /** El rango publicado, en segundos: lo menos y lo más que tarda. */
  desdeSeg: number;
  hastaSeg: number;
  /** El centro, para ordenar y sumar. Nunca se enseña solo: sin su rango miente. */
  medianaSeg: number;
}

/** Con menos travesías no se publica: un camión atorado movería el número (decisión de ASAV, 22-sep). */
export const MINIMO_TRAVESIAS = 10;

/** Más de una hora entre dos paradas no es un tramo: es un hueco del instrumento. */
export const TRAVESIA_MAXIMA_SEG = 3600;

export function recorridosPorTramo(
  pasos: PasoDeUnaUnidad[],
  opciones: { minimoTravesias?: number; travesiaMaximaSeg?: number } = {},
): TramoPublicado[] {
  const minimo = opciones.minimoTravesias ?? MINIMO_TRAVESIAS;
  const maxima = opciones.travesiaMaximaSeg ?? TRAVESIA_MAXIMA_SEG;

  // Sin repetidos: dos corridas del detector sobre los mismos días dan el mismo cruce dos veces.
  const unicos = new Map<string, PasoDeUnaUnidad>();
  for (const p of pasos) {
    unicos.set(`${p.unidad}|${p.sentido}|${p.parada}|${p.desde.getTime()}|${p.hasta.getTime()}`, p);
  }

  // Encadenados por unidad y sentido: un tramo es de un camión, no de dos.
  const porCamino = new Map<string, PasoDeUnaUnidad[]>();
  for (const p of unicos.values()) {
    const llave = `${p.unidad}|${p.sentido}`;
    porCamino.set(llave, [...(porCamino.get(llave) ?? []), p]);
  }

  const travesias = new Map<string, { sentido: Sentido; de: string; a: string; bajos: number[]; altos: number[] }>();
  for (const cadena of porCamino.values()) {
    const orden = [...cadena].sort((x, y) => x.desde.getTime() - y.desde.getTime());
    for (let i = 0; i + 1 < orden.length; i++) {
      const a = orden[i]!;
      const b = orden[i + 1]!;
      if (b.orden !== a.orden + 1) continue; // el detector se saltó una parada
      const bajo = Math.round((b.desde.getTime() - a.hasta.getTime()) / 1000);
      const alto = Math.round((b.hasta.getTime() - a.desde.getTime()) / 1000);
      if (bajo < 0) continue; // los rangos se traslapan: no se puede afirmar nada
      if (alto > maxima) continue;
      const llave = `${a.sentido}|${a.parada}|${b.parada}`;
      const t = travesias.get(llave) ?? { sentido: a.sentido, de: a.parada, a: b.parada, bajos: [], altos: [] };
      t.bajos.push(bajo);
      t.altos.push(alto);
      travesias.set(llave, t);
    }
  }

  const salida: TramoPublicado[] = [];
  for (const t of travesias.values()) {
    if (t.bajos.length < minimo) continue;
    const centros = t.bajos.map((b, i) => (b + t.altos[i]!) / 2);
    salida.push({
      sentido: t.sentido,
      de: t.de,
      a: t.a,
      travesias: t.bajos.length,
      desdeSeg: percentil(t.bajos, 0.25),
      hastaSeg: percentil(t.altos, 0.75),
      medianaSeg: percentil(centros, 0.5),
    });
  }
  return salida.sort((x, y) => x.sentido.localeCompare(y.sentido) || x.de.localeCompare(y.de));
}

/**
 * El percentil por interpolación, redondeado a segundos. p25 del piso y p75 del
 * techo en vez de mínimo y máximo: un semáforo largo o un ping perdido no
 * estiran el rango publicado.
 */
function percentil(valores: number[], p: number): number {
  const orden = [...valores].sort((a, b) => a - b);
  const lugar = (orden.length - 1) * p;
  const bajo = Math.floor(lugar);
  const alto = Math.ceil(lugar);
  if (bajo === alto) return Math.round(orden[bajo]!);
  return Math.round(orden[bajo]! + (orden[alto]! - orden[bajo]!) * (lugar - bajo));
}
