/**
 * ¿Se entra directo, o se enseña la portada?
 *
 * Con una sola cuenta la portada pide **elegir entre una opción** — un clic que
 * no decide nada. Es la misma regla que `Ficha-Diseno-Permisos.md` ya aplica un
 * nivel más adentro —«una sola planta o campus, entra directo ahí»— traída al
 * nivel de la cuenta.
 *
 * Vive aquí y no dentro de la portada porque **la decisión se prueba y el
 * componente de servidor no**: `page.tsx` consulta la base y no se puede
 * ejercitar sin montar medio mundo. Mismo reparto que `identidad-dev.ts` — la
 * decisión pura de un lado, el efecto del otro.
 */

/**
 * `puertas` son los destinos que la persona puede abrir de verdad: sus cuentas
 * de cliente más sus cuentas de carrier. **No son sus membresías** — una
 * identidad de alcance global tiene una sola fila y alcanza todas las cuentas.
 *
 * `hayJStaff` cuenta como puerta propia: quien tiene la consola **y** una cuenta
 * tiene **dos destinos reales**, y saltarse la consola sin enterarse sería
 * quitarle uno.
 */
export function entraDirecto(puertas: number, hayJStaff: boolean): boolean {
  return !hayJStaff && puertas === 1;
}
