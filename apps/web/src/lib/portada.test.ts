import { describe, it, expect } from "vitest";
import { sesionUtilizable } from "./guardia-pagina";
import type { Identidad } from "./auth";

/**
 * La regla que decide qué cara enseña la raíz.
 *
 * Vive aquí y no dentro de `page.tsx` porque es lo único de la portada que
 * decide algo: si devuelve `false`, se sirve el landing —que no trata datos— y
 * ningún nombre de cliente llega a la respuesta. Si devolviera `true` de más,
 * volvería la fuga del 4 de agosto de 2026.
 *
 * Es la MISMA función que usa la guardia de páginas, a propósito: dos copias de
 * esta condición se separan, y la que se quedaría vieja sería justo la que
 * decide si se enseñan nombres.
 */

function identidad(sesionActiva: boolean): Identidad {
  return {
    userId: sesionActiva ? "user_3HQ" : "jstaff_admin",
    origen: sesionActiva ? "clerk" : "variable-dev",
    memberships: [],
    clerkConfigurado: true,
    sesionActiva,
    encabezadoRechazado: false,
  };
}

describe("qué cara enseña la raíz", () => {
  it("en producción, sin sesión de Clerk → landing", () => {
    expect(sesionUtilizable(identidad(false), { enProduccion: true })).toBe(false);
  });

  it("en producción, con sesión → portada", () => {
    expect(sesionUtilizable(identidad(true), { enProduccion: true })).toBe(true);
  });

  /*
   * El caso que causó la fuga. En producción `JTEL_DEV_USER=jstaff_admin` está
   * puesto, así que un anónimo llega con identidad completa. Si la portada
   * mirara la identidad en vez de la sesión, le enseñaría los nombres.
   */
  it("el bypass NO abre la portada en producción", () => {
    const conBypass: Identidad = { ...identidad(false), origen: "variable-dev" };
    expect(sesionUtilizable(conBypass, { enProduccion: true })).toBe(false);
  });

  it("fuera de producción, el bypass sí sirve — o no se trabaja en local", () => {
    expect(sesionUtilizable(identidad(false), { enProduccion: false })).toBe(true);
  });
});
