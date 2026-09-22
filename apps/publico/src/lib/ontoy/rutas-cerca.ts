import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import { distanciaM } from "@/lib/ontoy/distancia";

/**
 * En qué orden se enseñan las rutas en Inicio (8.8; ASAV, 22-sep-2026).
 *
 * Son **dos órdenes distintos**, y la pantalla dice cuál está usando porque
 * cada uno afirma una cosa diferente.
 *
 * ## Con ubicación: por distancia, y se enseña POR DÓNDE
 *
 * La distancia de una ruta es la de **su parada más cercana** al pasajero, en
 * línea recta, calculada en el teléfono sobre la lista pública que ya bajó
 * (8.3b).
 *
 * Y esa parada **viaja con la ruta**, porque el renglón la nombra: «por
 * Hospital General, a 120 m». Ésa es la pregunta completa del pasajero —qué
 * ruta, y dónde la tomo—, y de paso hace comprobable el número: «a 120 m»
 * suelto es una distancia abstracta; «a 120 m de Hospital General» se puede
 * verificar parándose ahí.
 *
 * ✎ **22-sep-2026 (ASAV).** Antes esto sólo devolvía metros, y las paradas
 * cercanas vivían en una sección aparte de Inicio. Las dos secciones decían lo
 * mismo con los mismos números —la misma ruta, la misma distancia, una encima
 * de la otra—, así que se fundieron en esta lista. La sección de paradas se
 * retiró; su trabajo lo hace el renglón.
 *
 * ## Sin ubicación: alfabético, y NO se llaman «cerca de ti»
 *
 * Esto es lo que la ley obliga (8.7: la app no sabe quién eres). El orden sin
 * ubicación **no puede salir de rastrear a nadie** — nada de «las más
 * buscadas» ni «las más abiertas», que exigirían guardar lo que hace cada
 * pasajero. Alfabético es público, estable y no cuesta una petición.
 *
 * **Se evaluó ordenar por camiones en vivo y se descartó**, y conviene que
 * quede escrito para no volver a proponerlo: saber cuántos camiones trae cada
 * ruta cuesta una consulta por ruta cada quince segundos, para todas las rutas
 * de la ciudad — el costo que la lista de rutas ya había decidido no pagar. Y
 * en el arranque, con pocas unidades prendidas, el orden brincaría cada
 * sondeo delante de quien lo está mirando.
 *
 * ## Y el encabezado cambia con el orden
 *
 * Sin ubicación estas rutas **no son las más cercanas**: son tres rutas de la
 * ciudad. Llamarlas «cerca de ti» sería el dato correcto con la afirmación
 * falsa (Marco §D) — lo que miente no es la lista, es el título de encima. Por
 * eso esto devuelve `porDistancia`, y la pantalla titula con él.
 */

/** La parada por la que se toma una ruta: la más cercana al pasajero. */
export interface ParadaDeEntrada {
  id: string;
  nombre: string;
  sentido: "ida" | "vuelta" | null;
  distanciaM: number;
}

export interface RutaOrdenada {
  ruta: RutaDeLaCiudad;
  /**
   * Por dónde se toma, y a cuánto. `null` sin ubicación o sin paradas
   * publicadas: entonces el renglón no dice ni parada ni distancia, porque no
   * hay ninguna medida que decir.
   */
  entrada: ParadaDeEntrada | null;
}

export interface OrdenDeLasRutas {
  rutas: RutaOrdenada[];
  /** `true`: ordenadas por cercanía real. `false`: alfabético, y no son «cercanas». */
  porDistancia: boolean;
}

/** Cuántas se enseñan antes de que el pasajero pida el resto. */
export const RUTAS_A_LA_VISTA = 3;

/**
 * La parada más cercana de una ruta, con su distancia.
 * `null` si esa ruta no tiene ninguna parada publicada: no se inventa un punto
 * de entrada ni un número.
 */
export function paradaDeEntrada(
  yo: { lat: number; lon: number },
  circuitoId: string,
  paradas: ParadaDeLaCiudad[],
): ParadaDeEntrada | null {
  let mejor: ParadaDeEntrada | null = null;
  for (const p of paradas) {
    if (p.ruta !== circuitoId) continue;
    const d = distanciaM(yo, p);
    if (!mejor || d < mejor.distanciaM) {
      mejor = { id: p.id, nombre: p.nombre, sentido: p.sentido, distanciaM: d };
    }
  }
  return mejor;
}

export function ordenarRutas(
  rutas: RutaDeLaCiudad[],
  paradas: ParadaDeLaCiudad[],
  yo: { lat: number; lon: number } | null,
): OrdenDeLasRutas {
  const porNombre = (a: RutaOrdenada, b: RutaOrdenada) =>
    a.ruta.nombre.localeCompare(b.ruta.nombre, "es");

  if (!yo) {
    return {
      rutas: rutas.map((ruta) => ({ ruta, entrada: null })).sort(porNombre),
      porDistancia: false,
    };
  }

  const conDistancia = rutas.map((ruta) => ({
    ruta,
    entrada: paradaDeEntrada(yo, ruta.circuito_id, paradas),
  }));

  /*
   * Una ruta sin paradas publicadas no se esconde —una ruta que existe y no
   * aparece deja al pasajero buscándola— pero tampoco se cuela entre las
   * cercanas fingiendo una distancia que nadie midió: va al final, en su
   * orden alfabético, y su renglón no enseña número.
   */
  const medidas = conDistancia.filter((r) => r.entrada !== null);
  const sinMedir = conDistancia.filter((r) => r.entrada === null);

  return {
    rutas: [
      ...medidas.sort((a, b) => a.entrada!.distanciaM - b.entrada!.distanciaM || porNombre(a, b)),
      ...sinMedir.sort(porNombre),
    ],
    porDistancia: medidas.length > 0,
  };
}
