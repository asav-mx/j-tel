/**
 * El color de una ruta, derivado del dato.
 *
 * Salió de `vista-pasajero.tsx` cuando el buscador tuvo que pintar **varias**
 * rutas a la vez, cada una con el suyo. Y ahí se vio por qué tenía que salir:
 * el buscador no puede inyectar un `--ruta` único en la raíz de la pantalla,
 * porque no hay una ruta — hay las que haya. Cada tarjeta lleva el color de la
 * suya, y las dos pantallas derivan el tinte con esta misma función en vez de
 * con dos copias que se separen.
 */

/**
 * El tinte claro del color de la ruta, para fondos.
 *
 * Se deriva del color del dato en vez de guardarse aparte: pedir dos colores por
 * circuito duplica lo que hay que mantener y deja abierta la puerta a que no
 * combinen. En noche es una transparencia; en día, una mezcla con blanco.
 *
 * **Depende del tema y por eso recibe `noche`.** Un tinte que no lo mirara sería
 * un color definido en un solo tema: en la pantalla oscura se quedaría claro y
 * el texto encima —que sí sigue al tema— quedaría blanco sobre blanco. Es un
 * error silencioso; no rompe nada y sólo se ve mirando.
 */
export function tinte(hex: string, noche: boolean): string {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  if (Number.isNaN(r + g + b)) return noche ? "rgba(255,255,255,.12)" : "#eee";
  if (noche) return `rgba(${r},${g},${b},0.16)`;
  const mez = (c: number) => Math.round(c + (255 - c) * 0.88);
  return `rgb(${mez(r)},${mez(g)},${mez(b)})`;
}

/** Las iniciales del circuito para la insignia. Del dato, no del código. */
export function iniciales(nombre: string): string {
  const partes = nombre
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  if (partes.length === 0) return "··";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
