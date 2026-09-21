import type { LoMinimoParaMedir } from "@jtel/services";

/**
 * La cadena de un circuito — los siete pasos del expediente de J-Staff
 * (ficha de Circuitos en la casa nueva, 21-sep-2026): identidad, trazado,
 * paradas, promesa, unidades, medición y publicar.
 *
 * La misma función arma la línea de la lista y la cadena del expediente, para
 * que las dos pantallas nunca digan cosas distintas del mismo circuito.
 *
 * ## Qué pide y qué no
 *
 * Un paso **pide** algo cuando falta lo mínimo para medir — y eso no se decide
 * aquí: sale de `loMinimoParaMedir` (capa de servicios), la misma definición
 * que usa la torre. Lo que pide va en tinta; lo que está al día, en tenue (el
 * skill: «lo apagado se apaga»).
 *
 * **Publicar nunca pide.** Es acto de quien opera y el servidor no exige nada
 * (ASAV, 21-sep); la cadena enuncia, no empuja.
 *
 * **Sin glifo.** El prototipo v2 dibujaba cada paso con un cuadro redondeado
 * lleno, a medias o punteado; en el skill el cuadro es de los dispositivos, y
 * una forma nueva para «paso de la cadena» es una decisión del skill, no de
 * esta pantalla. Mientras tanto el estado va en palabras (mismo trato que el
 * cuarto de Contratos).
 */

export interface DatosDeLaCadena {
  trazados: Array<{ sentido: "ida" | "vuelta"; puntos: number }>;
  paradas: Array<{ sentido: "ida" | "vuelta" | null }>;
  franjasDeLaPromesa: number | null;
  unidadesAsignadas: number;
  publicado: boolean;
  minimo: LoMinimoParaMedir;
}

export interface Eslabon {
  paso: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  nombre: string;
  /** Dos o tres palabras: lo que hay, o lo que falta. */
  resumen: string;
  /** Falta algo de lo mínimo para medir: va en tinta. */
  pide: boolean;
  /** El ancla de su sección en el expediente. */
  ancla: string;
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function trazadoEnPalabras(trazados: DatosDeLaCadena["trazados"]): string {
  const hay = (s: "ida" | "vuelta") => trazados.some((t) => t.sentido === s && t.puntos >= 2);
  if (hay("ida") && hay("vuelta")) return "ida y vuelta";
  if (hay("ida")) return "sólo ida";
  if (hay("vuelta")) return "sólo vuelta";
  return "falta";
}

export function promesaEnPalabras(franjas: number | null): string {
  if (franjas === null) return "sin capturar";
  if (franjas === 0) return "sin franjas";
  return plural(franjas, "franja", "franjas");
}

export function cadenaDelCircuito(d: DatosDeLaCadena): Eslabon[] {
  const falta = new Set(d.minimo.faltan.map((f) => f.requisito));
  return [
    { paso: 1, nombre: "Identidad", resumen: "completa", pide: false, ancla: "identidad" },
    { paso: 2, nombre: "Trazado", resumen: trazadoEnPalabras(d.trazados), pide: falta.has("trazado"), ancla: "trazado" },
    {
      paso: 3,
      nombre: "Paradas",
      resumen: d.paradas.length === 0 ? "ninguna" : falta.has("paradas") ? `${d.paradas.length} · sin carril` : `${d.paradas.length}`,
      pide: falta.has("paradas"),
      ancla: "paradas",
    },
    { paso: 4, nombre: "Promesa", resumen: promesaEnPalabras(d.franjasDeLaPromesa), pide: falta.has("promesa"), ancla: "promesa" },
    {
      paso: 5,
      nombre: "Unidades",
      resumen: d.unidadesAsignadas === 0 ? "ninguna asignada" : plural(d.unidadesAsignadas, "asignada", "asignadas"),
      pide: falta.has("unidades"),
      ancla: "unidades",
    },
    {
      paso: 6,
      nombre: "Medición",
      resumen: d.minimo.listo ? "lista para medir" : "falta lo mínimo",
      pide: !d.minimo.listo,
      ancla: "medicion",
    },
    { paso: 7, nombre: "Publicar", resumen: d.publicado ? "publicado" : "sin publicar", pide: false, ancla: "publicar" },
  ];
}

/** La frase de lo que falta para medir — la misma lista que la torre, dicha. */
export function loQueFaltaEnPalabras(minimo: LoMinimoParaMedir): string {
  if (minimo.listo) return "Tiene lo mínimo para medir.";
  return `Para medir: ${minimo.faltan.map((f) => f.frase).join(" · ")}.`;
}
