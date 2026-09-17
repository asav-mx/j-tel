/**
 * Las medidas del Workbench, como funciones puras.
 *
 * Viven aparte de la carga de datos por la misma razón que el censo de
 * `recorrido.ts`: una medida que se prueba sin base de datos se puede probar
 * contra casos conocidos, y este producto ya aprendió lo que cuesta publicar un
 * instrumento sin pasarlo por casos conocidos.
 *
 * Lo que NO está aquí es tan importante como lo que sí: **no hay tiempo detenido
 * ni conteo de paradas.** Los dos se pueden calcular y los dos mentirían hoy —
 * la razón medida está en `Ficha-Workbench` §3.4. Las paradas existen como
 * lugares con duración para dibujarlas en el mapa; colapsarlas a un número es
 * justo lo que se decidió no hacer.
 */

import { type PuntoTraza } from "@jtel/domain";
import { SALTO_GPS_KMH } from "@jtel/services";
import { haversineKm } from "@jtel/verification";

/*
 * Huecos y tramos se mudaron a `@jtel/domain` (huecos.ts) para que el cuarto de
 * Compás parta la traza con la misma regla. Se reexportan para no mover a
 * quien ya los importaba de aquí.
 */
export {
  hayHuecoEntre,
  huecosDeSenal,
  ordenarPorTiempo,
  partirEnHuecos,
  type Hueco,
  type PuntoTraza,
} from "@jtel/domain";

/*
 * Las paradas se mudaron a `@jtel/domain` (paradas.ts) para que el recorrido
 * de Compás conserve las mismas al simplificar. Se reexportan.
 */
export {
  paradas,
  PARADA_MINUTOS_POR_DEFECTO,
  PARADA_VELOCIDAD_KMH,
  type Parada,
} from "@jtel/domain";

/**
 * Kilómetros recorridos, descartando saltos del equipo.
 *
 * Misma regla y mismo umbral que el censo de `recorrido.ts` — deliberadamente,
 * porque dos pantallas del mismo producto que suman kilómetros distintos para
 * la misma unidad destruyen la credibilidad de las dos. Y por eso el número
 * viaja SIEMPRE con sus descartes: cada salto deja un hueco en la suma y no hay
 * regla honesta para rellenarlo.
 */
export function kilometros(puntos: PuntoTraza[]): { km: number; saltosDescartados: number } {
  let km = 0;
  let saltosDescartados = 0;
  for (let i = 1; i < puntos.length; i += 1) {
    const a = puntos[i - 1]!;
    const b = puntos[i]!;
    const horas = (b.at.getTime() - a.at.getTime()) / 3_600_000;
    if (horas <= 0) continue;
    const tramo = haversineKm(a.lat, a.lng, b.lat, b.lng);
    if (tramo / horas > SALTO_GPS_KMH) {
      saltosDescartados += 1;
      continue;
    }
    km += tramo;
  }
  return { km, saltosDescartados };
}
