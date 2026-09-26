import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import type { Sentido } from "@/lib/ontoy/forma";
import { distanciaM, distanciaParaDecir, margenEnPalabras } from "@/lib/ontoy/distancia";

/**
 * **Qué parada se asoma abajo del mapa**, y por qué ésa.
 *
 * La regla es de ASAV (25-sep) y va en este orden, sin saltarse ninguno:
 *
 * 1. **La más cerca de ti**, si ya diste ubicación.
 * 2. **Sin ubicación, tu parada guardada** — la primera, en el orden en que tú
 *    las pusiste en «Tus paradas».
 * 3. **Sin nada, nada.** No se escoge una parada «de ejemplo» ni la primera de
 *    la ciudad: una hoja que se asoma con una parada que no es tuya ni está
 *    cerca afirmaría una relación que no existe.
 *
 * ## Por qué excluye sólo las rutas APAGADAS con su ojo
 *
 * El pasajero que apaga una ruta con su ojo dijo «ésta no». Si la asomada
 * escogiera una parada de esa ruta, la vería volver por abajo. El ojo manda
 * sobre la asomada, igual que manda sobre el dibujo.
 *
 * ⚠ **Apagadas, no «las que no están en la tira».** La primera versión filtraba
 * por las prendidas —las de la tira menos las apagadas— y sin ubicación la
 * tira es **alfabética**: una guardada cuya ruta empieza con Z quedaba fuera
 * por el alfabeto, no porque nadie la hubiera apagado, y la asomada no salía.
 * Lo enseñó la captura. Además la capa de guardadas del mapa las dibuja
 * siempre, estén o no en la tira, así que no hay Tino fantasma que evitar.
 *
 * ## Por qué la guardada es la PRIMERA, y no la más cercana ni la alfabética
 *
 * Sin ubicación no hay «más cercana» que calcular, y ordenar por nombre sería
 * inventar una preferencia. El orden de «Tus paradas» es el único que el
 * pasajero escogió: arriba puso la que más le importa.
 *
 * ## Lo que esto NO decide
 *
 * Qué llegada enseñar ni cómo dibujarla: eso es de la hoja, con el mismo dato
 * que usa cuando la parada se toca. Aquí sólo se escoge la parada y se dice por
 * qué, que es lo único que la pantalla tiene que poder explicar.
 */

/** Por qué se asoma ésta: lo que la pantalla dice debajo del nombre. */
export type PorQueSeAsoma =
  | { tipo: "la-mas-cerca"; distanciaM: number; margenM: number | null }
  | { tipo: "tu-guardada" };

export interface ParadaAsomada {
  id: string;
  ruta: string;
  nombre: string;
  sentido: Sentido | null;
  porQue: PorQueSeAsoma;
}

export function paradaAsomada(entrada: {
  /** Sólo si ya diste permiso: el mapa nunca pregunta. */
  yo: { lat: number; lon: number; margenM?: number | null } | null;
  paradas: readonly ParadaDeLaCiudad[];
  /** Las rutas que el pasajero apagó con su ojo. Sólo ésas se excluyen. */
  apagadas: ReadonlySet<string>;
  /** Tus paradas guardadas, en el orden en que las pusiste. */
  guardadas: ReadonlyArray<{ parada: string; ruta: string }>;
}): ParadaAsomada | null {
  const { yo, paradas, apagadas, guardadas } = entrada;
  const visibles = paradas.filter((p) => !apagadas.has(p.ruta));

  if (yo) {
    let mejor: ParadaDeLaCiudad | null = null;
    let d = Infinity;
    for (const p of visibles) {
      const dp = distanciaM(yo, p);
      /* `<` estricto: con dos a la misma distancia se queda la primera de la
         lista, y la asomada no brinca entre ellas de un sondeo al siguiente. */
      if (dp < d) {
        mejor = p;
        d = dp;
      }
    }
    if (mejor) return aAsomada(mejor, { tipo: "la-mas-cerca", distanciaM: d, margenM: yo.margenM ?? null });
  }

  for (const g of guardadas) {
    const p = visibles.find((x) => x.id === g.parada && x.ruta === g.ruta);
    /* Una guardada que ya no existe en la lista —se retiró— o cuya ruta está
       apagada se salta, y se prueba la siguiente. No se asoma un fantasma. */
    if (p) return aAsomada(p, { tipo: "tu-guardada" });
  }

  return null;
}

function aAsomada(p: ParadaDeLaCiudad, porQue: PorQueSeAsoma): ParadaAsomada {
  return { id: p.id, ruta: p.ruta, nombre: p.nombre, sentido: p.sentido, porQue };
}

/**
 * El renglón de debajo del nombre, **dicho como lo dice el diseño**.
 *
 * El texto no es nuestro: está escrito en `App Mapa.dc.html` («La más cerca de
 * ti · a 90 m en línea recta») y en `App Prototipo.dc.html`, que elige entre
 * «tu parada guardada» y «la más cerca de ti» con la misma regla que aquí.
 *
 * «En línea recta» no se quita: la distancia no es caminando, y «a 300 m» del
 * otro lado de una vía rápida no son 300 m de camino. La distancia se dice con
 * `distanciaEnPalabras`, la misma que usa Inicio, para que las dos pantallas no
 * digan dos números distintos de la misma parada.
 */
export function porQueEnPalabras(p: PorQueSeAsoma): string {
  if (p.tipo === "la-mas-cerca") {
    const d = distanciaParaDecir(p.distanciaM, p.margenM);
    /*
     * **Con ubicación imprecisa no hay «la más cerca» ni metros** (a1, 25-sep).
     * Con 3 km de margen, afirmar que ésta es LA más cerca y que está a 50 m
     * sería presentar el punto que dio el teléfono como dónde estás. Se dice
     * lo que sí se sabe: que anda cerca, y con qué margen.
     */
    if (d === null) return `Cerca de ti, más o menos · margen de ${margenEnPalabras(p.margenM!)}`;
    return `La más cerca de ti · ${d} en línea recta`;
  }
  return "Tu parada guardada";
}
