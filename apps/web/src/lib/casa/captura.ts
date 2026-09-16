/**
 * Lo que llega del formulario de un papel, revisado antes de tocar la base.
 *
 * La base también lo revisa —fechas en orden, una versión calculada con sus dos
 * fechas—, pero un rechazo de la base se lee como un error de sistema. Aquí se
 * revisa primero para contestar en palabras de quien captura, junto al campo.
 *
 * Nada de esto decide la fecha de vencimiento: si viene vacía, el repositorio
 * la calcula con la regla del tipo cuando se puede (`fechaDeVencimientoAGuardar`).
 */

export type AccionDePapel = "capturar" | "renovar" | "corregir";

export interface CapturaRevisada {
  folio: string | null;
  emitidoEl: string | null;
  venceElImpreso: string | null;
  nota: string | null;
}

export const LARGO_FOLIO = 80;
export const LARGO_NOTA = 500;

/** Una fecha civil que existe de verdad: `2026-02-30` no pasa. */
export function esFechaCivil(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [y, m, d] = valor.split("-").map(Number);
  const f = new Date(Date.UTC(y!, m! - 1, d!));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m! - 1 && f.getUTCDate() === d;
}

function texto(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

export function revisarCaptura(
  form: FormData,
): { ok: true; datos: CapturaRevisada } | { ok: false; error: string } {
  const folio = texto(form.get("folio"));
  const emitido = texto(form.get("emitidoEl"));
  const vence = texto(form.get("venceEl"));
  const nota = texto(form.get("nota"));

  if (folio.length > LARGO_FOLIO) return { ok: false, error: `El folio pasa de ${LARGO_FOLIO} caracteres.` };
  if (nota.length > LARGO_NOTA) return { ok: false, error: `La nota pasa de ${LARGO_NOTA} caracteres.` };
  if (emitido && !esFechaCivil(emitido)) return { ok: false, error: "La fecha de emisión no es una fecha válida." };
  if (vence && !esFechaCivil(vence)) return { ok: false, error: "La fecha de vencimiento no es una fecha válida." };
  if (emitido && vence && vence < emitido) {
    return { ok: false, error: "El papel no puede vencer antes de emitirse. Revisa las dos fechas." };
  }
  if (!folio && !emitido && !vence) {
    return { ok: false, error: "Captura al menos el folio o una de las fechas: un papel vacío no dice nada." };
  }

  return {
    ok: true,
    datos: { folio: folio || null, emitidoEl: emitido || null, venceElImpreso: vence || null, nota: nota || null },
  };
}
