/**
 * Utilidades compartidas para leer y normalizar campos de un `FormData`.
 * Centraliza el patrón repetido `String(formData.get(key) ?? "").trim()`.
 */

/** Lee un campo de texto: lo convierte a string, aplica `fallback` si falta y recorta espacios. */
export function formStr(formData: FormData, key: string, fallback = ""): string {
  return String(formData.get(key) ?? fallback).trim();
}

/** Igual que {@link formStr} pero devuelve `undefined` cuando el campo queda vacío. */
export function formStrOrUndefined(formData: FormData, key: string): string | undefined {
  return formStr(formData, key) || undefined;
}

/** Convierte un valor de formulario a entero, usando `fallback` si está vacío o no es numérico. */
export function toInt(value: unknown, fallback: number): number {
  const raw = String(value ?? "").trim();
  if (raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Genera un slug estable a partir de texto libre: quita acentos, colapsa
 * caracteres no alfanuméricos en guiones y recorta a `maxLen`.
 * Con `upper: true` produce un código en mayúsculas ("Planta Norte 2" → "PLANTA-NORTE-2").
 */
export function slugify(text: string, opts: { upper?: boolean; maxLen?: number } = {}): string {
  const { upper = false, maxLen = 60 } = opts;
  const stripped = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const cased = upper ? stripped.toUpperCase() : stripped.toLowerCase();
  return cased
    .replace(upper ? /[^A-Z0-9]+/g : /[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}
