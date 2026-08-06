import { describe, it, expect } from "vitest";

/**
 * La portada con una sola puerta — la regla, aislada de la pantalla.
 *
 * `page.tsx` es un componente de servidor que consulta la base; no se puede
 * ejercitar en una prueba de unidad sin montar medio mundo. Lo que sí se puede
 * —y es lo que decide— es la REGLA: cuántas puertas hay y si se entra directo.
 *
 * Se prueba aquí, junto a las tres formas de equivocarse:
 *
 *  - Entrar directo teniendo dos destinos → la persona pierde el otro.
 *  - No entrar directo teniendo uno → un clic que no decide nada.
 *  - Contar J-Staff como si no fuera puerta → quien tiene consola y una cuenta
 *    se salta la consola sin enterarse.
 */

import { entraDirecto } from "@/lib/puerta-unica";

describe("una sola puerta se abre sola", () => {
  it("una cuenta y sin consola: entra directo", () => {
    expect(entraDirecto(1, false)).toBe(true);
  });

  it("dos cuentas: portada, porque hay algo que elegir", () => {
    expect(entraDirecto(2, false)).toBe(false);
  });

  it("ninguna cuenta: portada, que es donde se explica que no hay acceso", () => {
    expect(entraDirecto(0, false)).toBe(false);
  });
});

describe("J-Staff cuenta como puerta", () => {
  it("consola MÁS una cuenta: portada — son dos destinos reales", () => {
    expect(entraDirecto(1, true)).toBe(false);
  });

  it("solo consola: portada, no hay cuenta a la que entrar", () => {
    expect(entraDirecto(0, true)).toBe(false);
  });

  /*
   * El caso que motivó la regla: Asav tiene alcance global, así que ve TODAS
   * las cuentas. Nunca cae en el camino directo, y es lo correcto — quien
   * cruza cuentas tiene que decir cuál está mirando.
   */
  it("alcance global con muchas cuentas: portada siempre", () => {
    expect(entraDirecto(3, true)).toBe(false);
    expect(entraDirecto(7, true)).toBe(false);
  });
});
