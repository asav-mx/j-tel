/**
 * **Lo mínimo para medir un circuito — definido UNA vez** (ficha de Circuitos
 * en la casa nueva de J-Staff, 21-sep-2026).
 *
 * Lo leen dos pantallas: el expediente de J-Staff (la frase de lo que falta) y
 * la torre (su caja vacía y su aviso de «sin unidades asignadas»). Dos
 * definiciones se separan el primer mes, y entonces el expediente dice «listo»
 * de un circuito cuya torre sale vacía — el dato correcto de otra cosa
 * (Marco §D).
 *
 * Son cuatro cosas, y ninguna se infiere de otra:
 *
 *  1. **Trazado** — al menos un sentido con un trazado de dos puntos o más.
 *  2. **Paradas** — al menos un sentido con **carril**: su trazado y dos
 *     paradas suyas (o de los dos sentidos). Un carril necesita un tramo, y un
 *     tramo necesita dos paradas.
 *  3. **Promesa** — una promesa vigente con al menos una franja. Sin ella la
 *     torre mide pasos pero no tiene contra qué compararlos (9.1c).
 *  4. **Unidades asignadas** — al menos una. **Asignada, no al aire**: que
 *     ninguna esté corriendo es una falla que la torre tiene que poder ver
 *     (ASAV, 21-sep), no algo que falte capturar.
 *
 * **Publicar no está aquí, y no por olvido.** Publicar es acto de quien opera y
 * el servidor no exige nada (ASAV, 21-sep: la decisión escrita en la ruta de
 * publicación se queda). Este módulo enuncia lo que falta; no cierra puertas.
 */

export type SentidoDelCircuito = "ida" | "vuelta";

export type RequisitoParaMedir = "trazado" | "paradas" | "promesa" | "unidades";

export interface EntradaLoMinimo {
  trazados: Array<{ sentido: SentidoDelCircuito; puntos: number }>;
  paradas: Array<{ sentido: SentidoDelCircuito | null }>;
  /** Franjas de la promesa vigente. `null`: nunca se capturó una promesa. */
  franjasDeLaPromesa: number | null;
  unidadesAsignadas: number;
}

export interface LoMinimoParaMedir {
  /** Los sentidos que tienen carril (trazado + dos paradas suyas). */
  carriles: SentidoDelCircuito[];
  faltan: Array<{ requisito: RequisitoParaMedir; frase: string }>;
  listo: boolean;
}

const SENTIDOS: SentidoDelCircuito[] = ["ida", "vuelta"];

/** Los sentidos con trazado de verdad: una línea necesita dos puntos. */
export function sentidosConTrazado(trazados: EntradaLoMinimo["trazados"]): SentidoDelCircuito[] {
  return SENTIDOS.filter((s) => trazados.some((t) => t.sentido === s && t.puntos >= 2));
}

/** Los sentidos con carril: trazado y dos paradas de ese sentido (o de los dos). */
export function carrilesDelCircuito(
  trazados: EntradaLoMinimo["trazados"],
  paradas: EntradaLoMinimo["paradas"],
): SentidoDelCircuito[] {
  const conTrazado = sentidosConTrazado(trazados);
  return conTrazado.filter((s) => paradas.filter((p) => p.sentido === null || p.sentido === s).length >= 2);
}

/** Asignada, no al aire: la regla de la torre para correr o no el reloj de las paradas. */
export function tieneUnidadesAsignadas(unidadesAsignadas: number): boolean {
  return unidadesAsignadas > 0;
}

export function loMinimoParaMedir(e: EntradaLoMinimo): LoMinimoParaMedir {
  const faltan: LoMinimoParaMedir["faltan"] = [];
  const conTrazado = sentidosConTrazado(e.trazados);
  const carriles = carrilesDelCircuito(e.trazados, e.paradas);

  if (conTrazado.length === 0) faltan.push({ requisito: "trazado", frase: "falta el trazado" });
  if (carriles.length === 0) {
    faltan.push({
      requisito: "paradas",
      frase:
        e.paradas.length === 0
          ? "faltan las paradas"
          : "ningún sentido tiene dos paradas sobre su trazado",
    });
  }
  if (e.franjasDeLaPromesa === null || e.franjasDeLaPromesa === 0) {
    faltan.push({
      requisito: "promesa",
      frase: e.franjasDeLaPromesa === null ? "falta la promesa" : "la promesa no tiene franjas",
    });
  }
  if (!tieneUnidadesAsignadas(e.unidadesAsignadas)) {
    faltan.push({ requisito: "unidades", frase: "sin unidades asignadas" });
  }

  return { carriles, faltan, listo: faltan.length === 0 };
}
