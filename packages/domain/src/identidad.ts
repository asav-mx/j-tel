/**
 * C20 · La valla contra agrupar por nombre.
 *
 * ## El caso, y no es hipotético
 *
 * 🟢 Medido el 7 de agosto de 2026 contra producción, solo lectura:
 *
 *  - **Dos turnos distintos llamados «Turno B»** —uno arranca 15:30, el otro
 *    18:00— en la misma cuenta cliente y con el mismo carrier.
 *  - **Ocho nombres de ruta repetidos** dentro del contrato del Campus:
 *    `Km 30` y `Oasis` tres veces cada uno; `Finca`, `Haciendas`,
 *    `Juarez Nuevo`, `Riveras`, `Sanders` y `Sierra Vista`, dos.
 *  - **Un nombre de perfil, `Km 30 - B`, en DOS CONTRATOS distintos** — uno del
 *    Campus y otro de Planta 47. Ése es el peor de los tres: los otros
 *    colapsan cosas de un mismo sitio, y éste **cruza contratos**, que es el
 *    eje sobre el que se factura.
 *
 * Los perfiles reales son **48 por id y 47 por nombre**. Esa unidad de
 * diferencia es exactamente lo que un corte por nombre pierde sin avisar.
 *
 * **Ya costó una premisa.** La decisión D2 se abrió como «Turno B declarado
 * 18:00» describiendo el turno del Campus mientras hablaba del de Planta 47 —y
 * el del Campus es el sano de los dos—. Y mordió a la propia medición que
 * descubrió la causa: el conteo de perfiles de C21 dio 48 por id y 47 por
 * nombre tres horas después de escribirla.
 *
 * ## Por qué esto es un tipo y no una recomendación
 *
 * 🟢 Al 7 de agosto **ningún conteo del código agrupa por nombre**: los índices
 * existentes son por id. O sea que esto no arregla un conteo falso de hoy —
 * **impide el de mañana**, que es cuando alguien escriba un corte «por turno» y
 * no piense en que hay dos.
 *
 * Una regla escrita no es una regla aplicada, y una que solo se pide se olvida.
 * Cuando el error está en quién llama y no en qué hace, la valla es el
 * compilador (regla 12). `agruparPorId(turnos, (t) => t.name)` **no compila**.
 *
 * ## Lo que esto NO es
 *
 * No deduplica. Deduplicar por nombre borraría filas reales y produciría un
 * número más bonito y más falso — es el error que §D caso 6 del Marco descarta
 * explícitamente. Aquí las dos filas siguen existiendo y siguen contando dos:
 * lo único que se impide es que una etiqueta las junte.
 *
 * Y no arregla la ETIQUETA, que es la otra mitad de C20: que un humano lea
 * «Turno B» y no sepa cuál. Eso es cambio de pantalla y vive en el rediseño.
 */

declare const marcaDeId: unique symbol;

/**
 * La clave de agrupación de una fila: su identificador estable.
 *
 * Es `string` en tiempo de ejecución y otra cosa para el compilador. La marca
 * no viaja a la base ni al JSON — solo existe para que un nombre no pueda
 * ocupar el lugar de un id.
 */
export type IdEstable = string & { readonly [marcaDeId]: true };

/**
 * La única forma sancionada de obtener una clave de agrupación.
 *
 * Recibe **la fila**, no una cadena, y eso es deliberado: si aceptara `string`,
 * `idDe(turno.name)` compilaría y la valla no valdría nada. Pidiendo la fila,
 * lo único que se puede sacar es su `id`.
 */
export function idDe<T extends { id: string }>(fila: T): IdEstable {
  return fila.id as IdEstable;
}

/**
 * Agrupa filas por identificador estable.
 *
 * `leer` tiene que devolver `IdEstable`, así que en la práctica es `idDe` o una
 * función que termine en él. Devolver `fila.name` no compila, y ése es el
 * punto entero de este módulo.
 */
export function agruparPorId<T>(
  filas: readonly T[],
  leer: (fila: T) => IdEstable,
): Map<IdEstable, T[]> {
  const grupos = new Map<IdEstable, T[]>();
  for (const fila of filas) {
    const clave = leer(fila);
    const existentes = grupos.get(clave) ?? [];
    existentes.push(fila);
    grupos.set(clave, existentes);
  }
  return grupos;
}

/**
 * Indexa filas por identificador estable — una por clave.
 *
 * Si dos filas comparten clave gana la última, y eso está bien: dos filas con
 * el mismo `id` no existen. Con nombres sí pasaría, y por eso el tipo no los
 * deja entrar.
 */
export function indexarPorId<T>(
  filas: readonly T[],
  leer: (fila: T) => IdEstable,
): Map<IdEstable, T> {
  const indice = new Map<IdEstable, T>();
  for (const fila of filas) indice.set(leer(fila), fila);
  return indice;
}

/**
 * Cuenta filas por identificador estable.
 *
 * Existe para que un corte —«cuántos servicios por turno»— tenga una función
 * sancionada a la que llamar. Sin ella, quien escribe el corte improvisa un
 * `Map` y la improvisación es donde entra el nombre.
 */
export function contarPorId<T>(
  filas: readonly T[],
  leer: (fila: T) => IdEstable,
): Map<IdEstable, number> {
  const cuenta = new Map<IdEstable, number>();
  for (const fila of filas) {
    const clave = leer(fila);
    cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1);
  }
  return cuenta;
}
