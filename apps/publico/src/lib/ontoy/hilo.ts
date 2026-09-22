import { avanceSobreTrazado } from "@jtel/domain";
import type { Forma, Sentido, Vivo } from "./forma";
import {
  dondeCaeLaParada,
  llegadasHasta,
  paradasEnPalabras,
  paradasHastaLaParada,
  rangoEnPalabras,
} from "./llegadas";

/**
 * **El hilo** — la ruta abierta como una línea (8.8, 8.8d; Ontoy 2.0, PR 3).
 *
 * Las paradas de un sentido en el orden en que pasa el camión, con los camiones
 * metidos entre ellas en el lugar de su posición real y, si el pasajero dio su
 * ubicación y está sobre el corredor, «aquí estás» en el suyo.
 *
 * **Aquí se arma; la pantalla sólo dibuja.** Nada se calcula dos veces: los
 * minutos salen de `llegadasHasta` (que ya pide el permiso de rango, o sea la
 * calibración) y las paradas de `paradasHastaLaParada` (PR 2). Lo que decide
 * entre las dos es el mismo `rango_activo` que decide en Inicio y en la hoja.
 *
 * ## Lo que cada renglón dice
 *
 * - **Una parada:** lo que le falta al próximo camión FRESCO que viene hacia
 *   ella — «4–7 min» calibrada, «a 2 paradas» sin calibrar. Si ninguno viene
 *   (ya pasaron todos, o no hay), **nada**: no hay número que dar.
 * - **Un camión:** su número y su edad. El viejo, además, `fresco: false`: la
 *   pantalla lo apaga y le cambia la forma (8.9).
 * - **Aquí estás:** con calibración, los minutos del próximo camión hasta el
 *   pasajero; **sin calibración, sólo el punto** — contar paradas hasta alguien
 *   que no está en una parada no es honesto (decisión de ASAV, 22-sep).
 */

export type RenglonDelHilo =
  | {
      tipo: "parada";
      id: string;
      nombre: string;
      /** «4–7 min», «a 2 paradas», o `null` si no hay camión que venga. */
      falta: string | null;
      guardada: boolean;
    }
  | { tipo: "unidad"; economico: string; fresca: boolean; antiguedadSeg: number }
  | { tipo: "aqui"; falta: string | null };

export function armarHilo(entrada: {
  forma: Forma;
  vivo: Vivo | null;
  sentido: Sentido;
  yo: { lat: number; lon: number } | null;
  velocidadKmh: number;
  trazadoPorSentido: Map<Sentido, Array<[number, number]>>;
  estaGuardada: (paradaId: string) => boolean;
}): RenglonDelHilo[] {
  const { forma, vivo, sentido, yo, velocidadKmh, trazadoPorSentido, estaGuardada } = entrada;
  const trazado = trazadoPorSentido.get(sentido);
  if (!trazado) return [];

  const enServicio = vivo !== null && vivo.estado !== "por_arrancar" && vivo.estado !== "fuera_de_horario";
  const calibrada = vivo?.rango_activo === true;

  /** Lo que le falta al próximo camión hasta una abscisa, o `null`. */
  const faltaHasta = (avanceMetros: number, paraElPasajero: boolean): string | null => {
    if (!vivo || !enServicio) return null;
    const minutos = llegadasHasta({ avanceMetros, sentido }, { forma, vivo, velocidadKmh, trazadoPorSentido })[0];
    if (minutos) return rangoEnPalabras(minutos.rango);
    if (paraElPasajero) return null; // sin calibración, «aquí estás» es sólo el punto
    const fresca = paradasHastaLaParada({ avanceMetros, sentido }, { forma, vivo, trazadoPorSentido }).find(
      (p) => p.fresca,
    );
    return fresca ? paradasEnPalabras(fresca.paradas) : null;
  };

  type ConAbscisa = { avance: number; orden: number; renglon: RenglonDelHilo };
  const todos: ConAbscisa[] = [];

  for (const p of forma.paradas) {
    if (p.sentido !== null && p.sentido !== sentido) continue;
    const avance = dondeCaeLaParada(p, trazado, forma.corredor_m);
    if (avance === null) continue;
    todos.push({
      avance,
      orden: 1,
      renglon: { tipo: "parada", id: p.id, nombre: p.nombre, falta: faltaHasta(avance, false), guardada: estaGuardada(p.id) },
    });
  }

  if (vivo && enServicio) {
    for (const u of vivo.unidades) {
      if (u.sentido !== sentido) continue;
      const donde = avanceSobreTrazado({ lat: u.lat, lon: u.lon }, trazado, forma.corredor_m);
      if (!donde) continue;
      // Un camión justo en una parada va DESPUÉS de ella: ya llegó, no le falta.
      todos.push({
        avance: donde.avanceMetros,
        orden: 2,
        renglon: { tipo: "unidad", economico: u.economico, fresca: u.fresco, antiguedadSeg: u.antiguedad_seg },
      });
    }
  }

  const mio = yo ? avanceSobreTrazado(yo, trazado, forma.corredor_m) : null;
  if (mio) {
    todos.push({ avance: mio.avanceMetros, orden: 0, renglon: { tipo: "aqui", falta: calibrada ? faltaHasta(mio.avanceMetros, true) : null } });
  }

  return todos.sort((a, b) => a.avance - b.avance || a.orden - b.orden).map((x) => x.renglon);
}

/**
 * Cómo se nombra un sentido en la cabeza: «hacia ‹última parada›», sacado de
 * la última parada de ese sentido sobre su trazado — dato del circuito, no
 * invento. Sin paradas que caigan en él, `null`, y la pantalla dice «Ida» o
 * «Vuelta» (decisión de ASAV, 22-sep).
 */
export function haciaDonde(
  forma: Forma,
  sentido: Sentido,
  trazadoPorSentido: Map<Sentido, Array<[number, number]>>,
): string | null {
  const trazado = trazadoPorSentido.get(sentido);
  if (!trazado) return null;
  let ultima: { avance: number; nombre: string } | null = null;
  for (const p of forma.paradas) {
    if (p.sentido !== null && p.sentido !== sentido) continue;
    const avance = dondeCaeLaParada(p, trazado, forma.corredor_m);
    if (avance !== null && (!ultima || avance > ultima.avance)) ultima = { avance, nombre: p.nombre };
  }
  return ultima ? `hacia ${ultima.nombre}` : null;
}
