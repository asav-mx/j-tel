import { haceNMinutos } from "@/lib/rotulo-de-la-tarjeta";
import { arranqueCorto, arranqueLargo } from "@/lib/fecha-arranque";
import { paradasEnPalabras, rangoEnPalabras, type LlegadaCalculada, type ParadasDeUnaUnidad } from "@/lib/ontoy/llegadas";
import type { Vivo } from "@/lib/ontoy/forma";
import type { PoseDeOntoy } from "@/components/ontoy/ontoy-muneco";
import { horaSinCero } from "@/lib/ontoy/horario-en-palabras";

/**
 * **Lo que Inicio dice de una parada guardada**, sin React: qué lectura toca y
 * con qué palabras. Vivía dentro de `atajo-de-parada.tsx`; salió aquí para
 * poder probar la frase —que es lo que puede mentir— sin montar la pantalla.
 *
 * ## Sin señal no se habla en presente (auditoría del 25-sep)
 *
 * Con la consulta caída, `useEnVivo` se queda con la **última** respuesta. La
 * tarjeta la seguía leyendo como si fuera de ahorita —«Tu Zaragoza–Centro
 * viene a 1 parada»— con el encabezado diciendo «Sin señal ahorita» encima: dos
 * afirmaciones que no pueden ser ciertas a la vez.
 *
 * Ahora, sin señal y con algo que ya se sabía, la lectura es **«lo último que
 * supimos»**: en pasado, sin cifra grande y con su edad, como el Mapa («Lo que
 * ves es lo último que supimos»). Vale también con los minutos prendidos: un
 * rango calculado desde una posición vieja es una predicción de hace rato.
 */

export type Lectura =
  | { tipo: "rango"; rango: string; unidad: string; edadSeg: number }
  | { tipo: "paradas"; paradas: number; unidad: string; edadSeg: number }
  | { tipo: "vieja"; paradas: number; unidad: string; edadSeg: number }
  /** Sin señal, lo último que se supo de la unidad: siempre en pasado. */
  | { tipo: "lo-ultimo"; paradas: number; unidad: string; edadSeg: number }
  | { tipo: "cargando" }
  | { tipo: "sin-red" }
  | { tipo: "sin-ruta" }
  | { tipo: "por-arrancar"; arrancaEl: string | null }
  | { tipo: "fuera"; abreA: string }
  | { tipo: "sin-unidad" };

/**
 * La escalera, en orden. **Sin señal va primero**: todo lo que viene después se
 * calcula con la última respuesta, y ninguna lectura en presente puede salir
 * de un dato que ya no se está pudiendo preguntar.
 */
export function elegirLectura(e: {
  error: boolean;
  cargando: boolean;
  vivo: Vivo | null;
  /** La primera llegada en minutos, si la ruta los tiene prendidos. */
  proxima: LlegadaCalculada | null;
  /** Las unidades contadas en paradas: primero las frescas, luego las viejas. */
  porParadas: ParadasDeUnaUnidad[];
}): Lectura {
  const fresca = e.porParadas.find((p) => p.fresca) ?? null;
  const vieja = e.porParadas.find((p) => !p.fresca) ?? null;

  if (e.error) {
    const ultima = fresca ?? vieja;
    return ultima
      ? { tipo: "lo-ultimo", paradas: ultima.paradas, unidad: ultima.unidad, edadSeg: ultima.antiguedadSeg }
      : { tipo: "sin-red" };
  }
  if (e.proxima) {
    return { tipo: "rango", rango: rangoEnPalabras(e.proxima.rango), unidad: e.proxima.unidad, edadSeg: e.proxima.antiguedadSeg };
  }
  if (fresca) return { tipo: "paradas", paradas: fresca.paradas, unidad: fresca.unidad, edadSeg: fresca.antiguedadSeg };
  if (e.cargando) return { tipo: "cargando" };
  if (!e.vivo) return { tipo: "sin-ruta" };
  if (e.vivo.estado === "por_arrancar") return { tipo: "por-arrancar", arrancaEl: e.vivo.arranca_el };
  if (e.vivo.estado === "fuera_de_horario") return { tipo: "fuera", abreA: e.vivo.abre_a };
  if (vieja) return { tipo: "vieja", paradas: vieja.paradas, unidad: vieja.unidad, edadSeg: vieja.antiguedadSeg };
  return { tipo: "sin-unidad" };
}

/**
 * **La edad de un dato que dejó de llegar sigue creciendo.** La que manda el
 * servidor es la de cuando contestó; si la red lleva diez minutos caída, «hace
 * 1 min» sería falso. Se le suma lo que pasó desde esa respuesta, medido con el
 * reloj del teléfono en los dos extremos (no con la hora del servidor, que
 * puede no coincidir con la del teléfono).
 */
export function edadAlDia(antiguedadSeg: number, recibidoEn: number | null, ahora: number): number {
  if (recibidoEn === null) return antiguedadSeg;
  return antiguedadSeg + Math.max(0, Math.round((ahora - recibidoEn) / 1000));
}

/** Lo que Ontoy dice de una lectura: su pose, la frase grande y la de apoyo. */
export function dichoDeOntoy(
  l: Lectura,
  ruta: string,
): { pose: PoseDeOntoy; dicho: string; apoyo: string | null } {
  const edad = (s: number) => `posición de ${haceNMinutos(s)}`;
  switch (l.tipo) {
    case "rango":
      return { pose: "mirando-arriba", dicho: `Tu ${ruta} llega en ${l.rango}`, apoyo: `viene la ${l.unidad} · ${edad(l.edadSeg)}` };
    case "paradas":
      return {
        pose: "mirando-arriba",
        dicho: `Tu ${ruta} viene ${paradasEnPalabras(l.paradas)}`,
        apoyo: `viene la ${l.unidad} · ${edad(l.edadSeg)}`,
      };
    case "lo-ultimo":
      return {
        pose: "sin-red",
        dicho: "Sin señal",
        apoyo: `Lo último que supimos: la ${l.unidad} iba ${paradasEnPalabras(l.paradas)}, ${edad(l.edadSeg)}.`,
      };
    case "por-arrancar": {
      const cuando = arranqueLargo(l.arrancaEl ?? "");
      return { pose: "al-frente", dicho: cuando ? `Pronto salimos: ${cuando}` : "Pronto salimos", apoyo: null };
    }
    case "fuera":
      return { pose: "dormido", dicho: `Vuelven a las ${horaSinCero(l.abreA)}`, apoyo: "Fuera de horario. Todavía no sale ninguna unidad." };
    case "vieja":
      return {
        pose: "dormido",
        dicho: `No veo tu ${ruta} ahorita`,
        apoyo: `No te invento una hora. Lo último que supe: la ${l.unidad} iba ${paradasEnPalabras(l.paradas)}, ${edad(l.edadSeg)}.`,
      };
    case "sin-unidad":
      return { pose: "dormido", dicho: `No veo tu ${ruta} ahorita`, apoyo: "No te invento una hora." };
    case "sin-red":
      return { pose: "sin-red", dicho: "Sin señal", apoyo: "No pudimos preguntar ahorita." };
    case "cargando":
      return { pose: "sin-dato", dicho: "Preguntando…", apoyo: null };
    case "sin-ruta":
      return { pose: "sin-dato", dicho: "Sin datos de esta ruta ahorita", apoyo: null };
  }
}

/** Lo que dice el renglón compacto, a la derecha: corto, y con su edad cuando es medido. */
export function dichoDelRenglon(l: Lectura): { grande: string | null; chico: string } {
  switch (l.tipo) {
    case "rango":
      return { grande: l.rango, chico: `la ${l.unidad} · ${haceNMinutos(l.edadSeg)}` };
    case "paradas":
      return { grande: `${l.paradas} ${l.paradas === 1 ? "parada" : "paradas"}`, chico: `la ${l.unidad} · ${haceNMinutos(l.edadSeg)}` };
    case "vieja":
      return { grande: null, chico: `la ${l.unidad} iba ${paradasEnPalabras(l.paradas)} · ${haceNMinutos(l.edadSeg)}` };
    case "lo-ultimo":
      return { grande: null, chico: `sin señal · la ${l.unidad} iba ${paradasEnPalabras(l.paradas)} · ${haceNMinutos(l.edadSeg)}` };
    case "por-arrancar": {
      const cuando = arranqueCorto(l.arrancaEl ?? "");
      return { grande: null, chico: cuando ? `arranca el ${cuando}` : "todavía no arranca" };
    }
    case "fuera":
      return { grande: null, chico: `abre a las ${horaSinCero(l.abreA)}` };
    case "sin-unidad":
      return { grande: null, chico: "sin unidad a la vista" };
    case "sin-red":
      return { grande: null, chico: "sin señal" };
    case "cargando":
      return { grande: null, chico: "Preguntando…" };
    case "sin-ruta":
      return { grande: null, chico: "sin datos ahorita" };
  }
}
