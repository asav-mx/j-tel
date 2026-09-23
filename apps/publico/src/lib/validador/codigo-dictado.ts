/**
 * De los ocho dígitos dictados al folio que el lector quema.
 *
 * ## Por qué esto no es una tontería de formato
 *
 * La memoria de quemados del aparato se guarda **por folio**. El QR trae el
 * folio entero (`ONT-00042042`); el pasajero dicta sólo los dígitos
 * (`0004 2042`), porque un teclado de validador no tiene letras. Si las dos
 * vías no llegan a la **misma llave**, el lector quemaría dos cosas distintas y
 * «este boleto ya se usó» dejaría de valer al cruzar de una vía a la otra: el
 * mismo viaje pasaría una vez por cámara y otra por teclado, en el mismo
 * aparato, sin que nada lo notara.
 *
 * Esta función sabe **cómo se ve un folio de laboratorio** y por eso vive en la
 * app y no en el dominio: el día que los folios los emita J-Tel de su lado y
 * tengan otra forma, se cambia aquí. La prueba lo ata a `codigoParaDictar`, que
 * es la que el pase enseña, para que no se puedan separar en silencio.
 */

const PREFIJO = "ONT-";

export function folioDelCodigoDictado(tecleado: string): string | null {
  const digitos = tecleado.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  return `${PREFIJO}${digitos}`;
}
