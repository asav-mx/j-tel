/**
 * Los agregados de Cumplimiento y el selector de resultado.
 *
 * Viven aparte de la vista porque encierran dos leyes que la vista puede
 * romper sin que nada se queje al compilar:
 *
 *  - **Un agregado dice la verdad del periodo completo, siempre.** Contarlo
 *    sobre lo filtrado hacía que al filtrar a `cumplido` la tarjeta "No
 *    cumplidos" mostrara 0 — correcto para el conjunto filtrado, y falso como
 *    afirmación sobre el periodo, que es lo que una tarjeta de agregado
 *    afirma. El filtro es una lente sobre la tabla, no sobre los hechos.
 *
 *  - **Los resultados son tres y nada más.** `sin_verificar` no es un cuarto:
 *    es ausencia de resultado, el motor todavía no juzgó ese servicio. Puesto
 *    en la misma fila de opciones se lee como un cuarto veredicto del que
 *    elegir, y eso viola la ley de los tres.
 */

export type EstadoDeHecho = "cumplido" | "no_cumplido" | "pendiente_evidencia";

export type FiltroResultado = "all" | EstadoDeHecho;

/**
 * El selector de resultado: los tres, más "todos". `sin_verificar` NO entra —
 * se dibuja aparte, con su propia etiqueta y separado de esta fila.
 */
export const FILTROS_DE_RESULTADO: Array<{ id: FiltroResultado; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "cumplido", label: "Cumplido" },
  { id: "no_cumplido", label: "No cumplido" },
  // El estado canónico se llama así completo; acortarlo a "Pendiente" deja en
  // el aire pendiente de qué, que es justo lo que le da credibilidad.
  { id: "pendiente_evidencia", label: "Pendiente por evidencia" },
];

/*
 * La valla es de TIPOS y no de prueba, a propósito.
 *
 * La regresión no vivía dentro de `contarPeriodo` —contar siempre contó bien—
 * sino en el sitio de llamada: se le pasaba el arreglo ya filtrado por
 * resultado. Ninguna prueba sobre una función pura ve eso; el compilador sí.
 *
 * `aplicarFiltroResultado` marca lo que devuelve, y `contarPeriodo` se niega a
 * recibir algo marcado. Volver a cometer el error deja de compilar.
 */
declare const filtradaPorResultado: unique symbol;

export type Filtradas<T> = T[] & { readonly [filtradaPorResultado]: true };

/** La lente del usuario sobre la TABLA. Lo que devuelve ya no sirve para contar. */
export function aplicarFiltroResultado<T extends { complianceFact?: { status?: string | null } | null }>(
  ocurrencias: T[],
  filtro: FiltroResultado | "sin_verificar",
): Filtradas<T> {
  if (filtro === "all") return ocurrencias as Filtradas<T>;
  if (filtro === "sin_verificar") {
    return ocurrencias.filter((o) => !o.complianceFact) as Filtradas<T>;
  }
  return ocurrencias.filter((o) => o.complianceFact?.status === filtro) as Filtradas<T>;
}

export type AgregadosPeriodo = {
  total: number;
  cumplido: number;
  no_cumplido: number;
  pendiente: number;
  /** Ausencia de resultado, no un cuarto resultado. Se muestra fuera del grupo. */
  sin_verificar: number;
};

/**
 * Cuenta el periodo completo. Recibe las ocurrencias YA acotadas por fecha,
 * turno y perfil —esas sí definen de qué periodo hablamos— y nunca las
 * acotadas por resultado, que es la lente del usuario sobre la tabla.
 */
export function contarPeriodo(
  ocurrencias: Array<{ complianceFact?: { status?: string | null } | null }> & {
    // Rechaza por tipo lo que salió de `aplicarFiltroResultado`.
    readonly [filtradaPorResultado]?: never;
  },
): AgregadosPeriodo {
  const con = (estado: EstadoDeHecho) =>
    ocurrencias.filter((o) => o.complianceFact?.status === estado).length;

  return {
    total: ocurrencias.length,
    cumplido: con("cumplido"),
    no_cumplido: con("no_cumplido"),
    pendiente: con("pendiente_evidencia"),
    sin_verificar: ocurrencias.filter((o) => !o.complianceFact).length,
  };
}
