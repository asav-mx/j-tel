import type { RutaDeLaCiudad } from "@/lib/ontoy/forma";
import type { ParadaDeLaCiudad } from "@/lib/paradas-de-la-ciudad";
import { distanciaM } from "@/lib/ontoy/paradas-cerca";

/**
 * En qué orden se enseñan las rutas en Inicio (8.8; ASAV, 22-sep-2026).
 *
 * Son **dos órdenes distintos**, y la pantalla dice cuál está usando porque
 * cada uno afirma una cosa diferente.
 *
 * ## Con ubicación: por distancia, y la distancia se enseña
 *
 * La distancia de una ruta es la de **su parada más cercana** al pasajero, en
 * línea recta, calculada en el teléfono sobre la lista pública que ya bajó
 * (8.3b). Va a la vista en cada renglón: un orden que no se puede comprobar
 * pide que le crean, y aquí se puede comprobar.
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

export interface RutaOrdenada {
  ruta: RutaDeLaCiudad;
  /** Metros a su parada más cercana, o `null` sin ubicación o sin paradas. */
  distanciaM: number | null;
}

export interface OrdenDeLasRutas {
  rutas: RutaOrdenada[];
  /** `true`: ordenadas por cercanía real. `false`: alfabético, y no son «cercanas». */
  porDistancia: boolean;
}

/** Cuántas se enseñan antes de que el pasajero pida el resto. */
export const RUTAS_A_LA_VISTA = 3;

/**
 * La distancia del pasajero a la parada más cercana de una ruta.
 * `null` si esa ruta no tiene ninguna parada publicada: no se inventa un número.
 */
export function distanciaALaRuta(
  yo: { lat: number; lon: number },
  circuitoId: string,
  paradas: ParadaDeLaCiudad[],
): number | null {
  let menor: number | null = null;
  for (const p of paradas) {
    if (p.ruta !== circuitoId) continue;
    const d = distanciaM(yo, p);
    if (menor === null || d < menor) menor = d;
  }
  return menor;
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
      rutas: rutas.map((ruta) => ({ ruta, distanciaM: null })).sort(porNombre),
      porDistancia: false,
    };
  }

  const conDistancia = rutas.map((ruta) => ({
    ruta,
    distanciaM: distanciaALaRuta(yo, ruta.circuito_id, paradas),
  }));

  /*
   * Una ruta sin paradas publicadas no se esconde —una ruta que existe y no
   * aparece deja al pasajero buscándola— pero tampoco se cuela entre las
   * cercanas fingiendo una distancia que nadie midió: va al final, en su
   * orden alfabético, y su renglón no enseña número.
   */
  const medidas = conDistancia.filter((r) => r.distanciaM !== null);
  const sinMedir = conDistancia.filter((r) => r.distanciaM === null);

  return {
    rutas: [
      ...medidas.sort((a, b) => a.distanciaM! - b.distanciaM! || porNombre(a, b)),
      ...sinMedir.sort(porNombre),
    ],
    porDistancia: medidas.length > 0,
  };
}
