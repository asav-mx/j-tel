/**
 * Validación del IMEI antes de darlo de alta.
 *
 * ## Por qué hace falta, y por qué ya
 *
 * El IMEI es lo único que liga un equipo físico con su fila en J-Tel y con su
 * alta en Traccar. **Un dígito mal tecleado no truena en ninguna parte**: el
 * aparato se registra, Traccar nunca recibe ese IMEI, y la tabla no crece. Es
 * el mismo síntoma que un equipo sin señal, así que se diagnostica tarde.
 *
 * Los IMEI traen un **dígito verificador** (el 15.º, algoritmo de Luhn), que
 * existe justo para esto. Comprobado el 14 de septiembre de 2026 con los cuatro
 * FTC927 reales de Compás: los cuatro lo pasan, y cambiando un solo dígito de
 * cualquiera, falla.
 *
 * ## Lo que se normaliza, y por qué no es cosmético
 *
 * Se quitan espacios y guiones antes de validar: los IMEI se copian de
 * etiquetas y de programas que los agrupan («8606 9308 2402 380»). Antes se
 * guardaba tal cual con sólo `trim()`, así que **un espacio en medio quedaba
 * dentro del IMEI guardado y nunca iba a coincidir con Traccar**, sin avisar.
 *
 * ## Lo que NO atrapa
 *
 * El dígito verificador detecta cualquier dígito cambiado y casi todas las
 * transposiciones de dos dígitos contiguos, pero **no la de un 0 con un 9**
 * («09» ↔ «90»). Tampoco sabe si el IMEI es de un equipo nuestro: sólo si es un
 * IMEI bien formado.
 */

export type ValidacionImei =
  | { ok: true; imei: string }
  | { ok: false; motivo: string };

/** Deja sólo lo que se tecleó como dígitos: fuera espacios y guiones. */
export function normalizarImei(crudo: string): string {
  return crudo.replace(/[\s-]/g, "");
}

/** Luhn sobre los 15 dígitos: el último es el verificador. */
export function digitoVerificadorCuadra(imei: string): boolean {
  let suma = 0;
  for (let i = 0; i < imei.length; i++) {
    let d = imei.charCodeAt(imei.length - 1 - i) - 48;
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return suma % 10 === 0;
}

export function validarImei(crudo: string): ValidacionImei {
  const imei = normalizarImei(crudo);

  if (imei.length === 0) {
    return { ok: false, motivo: "El IMEI es requerido." };
  }
  if (!/^\d+$/.test(imei)) {
    return {
      ok: false,
      motivo: `El IMEI «${crudo.trim()}» tiene caracteres que no son dígitos. Sólo van números.`,
    };
  }
  if (imei.length !== 15) {
    return {
      ok: false,
      motivo: `El IMEI ${imei} tiene ${imei.length} dígitos y debe tener 15. Revisa si falta o sobra alguno.`,
    };
  }
  if (!digitoVerificadorCuadra(imei)) {
    return {
      ok: false,
      motivo: `El IMEI ${imei} no es válido: su último dígito, el verificador, no cuadra. Casi siempre es un dígito mal tecleado; compáralo contra la etiqueta.`,
    };
  }
  return { ok: true, imei };
}
