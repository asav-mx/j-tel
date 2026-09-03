/**
 * Emparejar lo que el pasajero escribe contra **lo que el sistema ya conoce**:
 * los nombres de las paradas publicadas y los de las rutas.
 *
 * ## Por qué no hay un buscador de direcciones
 *
 * Entender «Av. Tecnológico 1500» pide un geocodificador, y todos viven fuera.
 * Mandar allá lo que el pasajero escribió sería mandar su destino a un tercero
 * —su casa, su trabajo, un hospital—, que dice de él todavía más que su
 * ubicación actual. La ley de esta app es que nada suyo sale del teléfono, y un
 * buscador de direcciones la rompería por el dato más íntimo y por una puerta
 * lateral. Decisión de Asav, 2 de septiembre de 2026; queda en `DESPUES.md` §6
 * como aplazada, no descartada.
 *
 * La consecuencia es un límite real: **esto no entiende calle y número.** Se
 * declara en la pantalla, no se esconde — una app que calla lo que no sabe hace
 * que el pasajero crea que escribió mal.
 *
 * Todo esto corre en el teléfono, sobre las paradas que la forma ya bajó. No
 * hace ni una petición.
 */

export interface ParadaBuscable {
  id: string;
  nombre: string;
  lat: number;
  lon: number;
  circuitoSlug: string;
  circuitoNombre: string;
}

export interface RutaBuscable {
  slug: string;
  nombre: string;
}

export type Sugerencia =
  /** Un lugar con coordenadas: se puede medir contra el recorrido. */
  | { tipo: "parada"; clave: string; nombre: string; lat: number; lon: number; circuitoNombre: string }
  /**
   * El nombre de una ruta. **No es un destino y no se trata como tal:** una
   * ruta no es un punto, y proyectarla no significa nada. Se ofrece aparte,
   * rotulada distinto, porque quien escribe el nombre de su ruta quiere verla —
   * y sin esto se quedaría con una lista vacía creyendo que escribió mal.
   */
  | { tipo: "ruta"; clave: string; nombre: string; slug: string };

/** Cuántas se enseñan. Si hay más, la pantalla lo dice — no se recorta callando. */
export const MAXIMO_SUGERENCIAS = 6;

/**
 * Minúsculas y sin acentos, para que «hospital» encuentre «Hospital» y
 * «Peñón» encuentre «Penon». El teclado de un teléfono en la calle no siempre
 * pone el acento, y no encontrar por eso se lee como que la parada no existe.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface ResultadoDeEmparejar {
  sugerencias: Sugerencia[];
  /** Cuántas quedaron fuera del corte. Cero cuando cupieron todas. */
  omitidas: number;
}

/**
 * Las coincidencias, ordenadas por lo que empieza igual antes que lo que sólo
 * contiene. Escribir «cen» pone «Centro» arriba de «Mercado Central».
 *
 * **Las paradas que comparten nombre NO se funden.** Dos rutas pueden tener su
 * «Centro», y son lugares distintos con coordenadas distintas; colapsarlas por
 * el nombre daría una lista más corta y más falsa, y mandaría al pasajero a la
 * esquina equivocada. Cada una viaja con el nombre de su ruta para que el
 * lector pueda distinguirlas.
 */
export function emparejarLugares(
  consulta: string,
  paradas: ParadaBuscable[],
  rutas: RutaBuscable[],
): ResultadoDeEmparejar {
  const q = normalizar(consulta);
  if (q.length === 0) return { sugerencias: [], omitidas: 0 };

  const puntuar = (nombre: string): number | null => {
    const n = normalizar(nombre);
    if (n.startsWith(q)) return 0;
    if (n.includes(q)) return 1;
    return null;
  };

  const conPeso: Array<{ peso: number; s: Sugerencia }> = [];

  for (const p of paradas) {
    const peso = puntuar(p.nombre);
    if (peso === null) continue;
    conPeso.push({
      peso,
      s: {
        tipo: "parada",
        clave: `${p.circuitoSlug}:${p.id}`,
        nombre: p.nombre,
        lat: p.lat,
        lon: p.lon,
        circuitoNombre: p.circuitoNombre,
      },
    });
  }

  for (const r of rutas) {
    const peso = puntuar(r.nombre);
    if (peso === null) continue;
    /* Las rutas van después de las paradas a igualdad de peso: lo que se pidió
       es un destino, y una ruta no lo es. */
    conPeso.push({
      peso: peso + 0.5,
      s: { tipo: "ruta", clave: `ruta:${r.slug}`, nombre: r.nombre, slug: r.slug },
    });
  }

  conPeso.sort((a, b) => a.peso - b.peso || a.s.nombre.localeCompare(b.s.nombre, "es"));

  return {
    sugerencias: conPeso.slice(0, MAXIMO_SUGERENCIAS).map((c) => c.s),
    omitidas: Math.max(0, conPeso.length - MAXIMO_SUGERENCIAS),
  };
}
