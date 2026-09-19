/**
 * Las acciones sobre una unidad — C4-e del cuarto de Compás.
 *
 * Marco 6.18: «lo que se puede crear se puede corregir desde la pantalla».
 * Hasta C4-e la casa nueva sólo asignaba dispositivos a unidades que ya
 * existían: dar de alta un camión o corregir su placa pedía el alta vieja o un
 * guion. Aquí viven las reglas sin base ni pantalla: qué es un nombre, qué es
 * un VIN, y cuándo dos nombres son el mismo.
 *
 * Decisiones de Asav, 18 de septiembre de 2026:
 *
 *   · la unidad gana su **VIN**, opcional y **único por cuenta** — no en la
 *     plataforma: el camión es del transportista, y un aviso que dijera «ya
 *     existe en otra cuenta» delataría lo que hay del otro lado del muro;
 *   · **ningún nombre se repite dentro de una cuenta** (unidades, dispositivos
 *     en servicio y, cuando existan sus altas, usuarios — Tramo 7);
 *   · corregir la identidad **sobrescribe, sin historia**. La bitácora de
 *     correcciones queda como pendiente con nombre, y no es decorativa:
 *     renombrar un número económico cambia cómo se lee toda su historia.
 */

/** Lo más largo que se guarda como número económico. Un nombre, no una descripción. */
export const NOMBRE_DE_UNIDAD_MAX = 40;
/** Lo más largo que se guarda como placa. */
export const PLACA_MAX = 12;

/** Colapsa los espacios de en medio y quita los de los lados. */
const limpio = (texto: string | null | undefined) => (texto ?? "").replace(/\s+/g, " ").trim();

/**
 * La forma de un nombre con la que se compara, nunca la que se muestra: sin
 * mayúsculas, sin espacios a los lados y con los de en medio contados como
 * uno. «2101», « 2101 » y «ab 1»/«AB  1» son el mismo nombre.
 *
 * **Es la misma expresión que los índices únicos de la 0040**
 * (`regexp_replace(lower(btrim(label)), '\s+', ' ', 'g')`). Si una cambia, la
 * otra también: el código diría «libre» y la base diría «repetido».
 */
export function nombreComparable(nombre: string): string {
  return limpio(nombre).toLowerCase();
}

export type ErrorDeUnidad =
  | "nombre_vacio"
  | "nombre_largo"
  | "placa_larga"
  | "vin_invalido"
  | "nombre_repetido"
  | "vin_repetido";

/** Cada error en palabras de quien captura. `nombre_repetido` y `vin_repetido` se arman con el dato. */
export const PALABRAS_DE_UNIDAD: Record<Exclude<ErrorDeUnidad, "nombre_repetido" | "vin_repetido">, string> = {
  nombre_vacio: "Escribe el número económico de la unidad.",
  nombre_largo: `El número económico no puede pasar de ${NOMBRE_DE_UNIDAD_MAX} caracteres.`,
  placa_larga: `La placa no puede pasar de ${PLACA_MAX} caracteres.`,
  vin_invalido: "El VIN tiene 17 letras y números, sin I, O ni Q. Revisa que esté completo.",
};

export const palabrasDeNombreRepetido = (nombre: string) => `Ya hay una unidad ${nombre} en esta cuenta.`;
export const palabrasDeVinRepetido = (vin: string) => `El VIN ${vin} ya es de otra unidad de esta cuenta.`;

/**
 * El VIN como se guarda: mayúsculas, sin espacios ni guiones. Vacío es «sin
 * VIN» (null), no un VIN inválido: es opcional.
 */
export function normalizarVin(texto: string | null | undefined): string | null {
  const v = (texto ?? "").replace(/[\s-]+/g, "").toUpperCase();
  return v.length === 0 ? null : v;
}

/**
 * 17 caracteres, letras y números, sin I, O ni Q (ISO 3779: se confunden con 1
 * y 0). **El dígito verificador no se exige**: es obligatorio en Estados
 * Unidos y Canadá, pero no todos los VIN de vehículos vendidos en México lo
 * traen bien, y rechazar un VIN verdadero por su dígito sería peor que no
 * tenerlo.
 */
export function esVinValido(vin: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(vin);
}

export type IdentidadCapturada = { nombre: string; placa: string | null; vin: string | null };

/**
 * La identidad de una unidad como la capturó alguien, ya limpia, o el primer
 * problema en palabras. La placa se guarda en mayúsculas: así se escribe en la
 * lámina. El nombre conserva sus mayúsculas —es como lo escribe el
 * transportista—; para compararlo se usa `nombreComparable`.
 */
export function identidadCapturada(entrada: {
  nombre: string | null | undefined;
  placa: string | null | undefined;
  vin: string | null | undefined;
}): { ok: true; identidad: IdentidadCapturada } | { ok: false; error: Exclude<ErrorDeUnidad, "nombre_repetido" | "vin_repetido"> } {
  const nombre = limpio(entrada.nombre);
  if (nombre.length === 0) return { ok: false, error: "nombre_vacio" };
  if (nombre.length > NOMBRE_DE_UNIDAD_MAX) return { ok: false, error: "nombre_largo" };
  const placa = limpio(entrada.placa).toUpperCase() || null;
  if (placa && placa.length > PLACA_MAX) return { ok: false, error: "placa_larga" };
  const vin = normalizarVin(entrada.vin);
  if (vin && !esVinValido(vin)) return { ok: false, error: "vin_invalido" };
  return { ok: true, identidad: { nombre, placa, vin } };
}

/**
 * ¿Choca esta identidad con otra unidad de la misma cuenta? `mismaId` es la
 * unidad que se está corrigiendo: no choca consigo misma, así que corregir la
 * placa de la 2101 sin tocar su nombre no es «ya hay una 2101».
 *
 * Se revisa aquí para decirlo en palabras; la base lo garantiza aunque alguien
 * se salte este código (0040).
 */
export function choqueDeIdentidad(
  identidad: IdentidadCapturada,
  otras: Array<{ id: string; label: string; vin: string | null }>,
  mismaId: string | null = null,
): { error: "nombre_repetido"; mensaje: string } | { error: "vin_repetido"; mensaje: string } | null {
  const ajenas = otras.filter((u) => u.id !== mismaId);
  const nombre = nombreComparable(identidad.nombre);
  const conNombre = ajenas.find((u) => nombreComparable(u.label) === nombre);
  if (conNombre) return { error: "nombre_repetido", mensaje: palabrasDeNombreRepetido(conNombre.label) };
  if (identidad.vin) {
    const conVin = ajenas.find((u) => u.vin === identidad.vin);
    if (conVin) return { error: "vin_repetido", mensaje: palabrasDeVinRepetido(identidad.vin) };
  }
  return null;
}
