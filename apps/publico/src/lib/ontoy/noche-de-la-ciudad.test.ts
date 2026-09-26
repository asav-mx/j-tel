import { describe, expect, it } from "vitest";
import { ciudadCerrada, vuelvenEnPalabras } from "./noche-de-la-ciudad";
import type { EstadoDeRuta } from "./estado-de-ruta";

/*
 * **La ciudad cerrada.**
 *
 * ## Qué NO prueba
 *
 * **No prueba el horario.** Quién está abierto lo decide el servidor con la
 * zona del circuito (8.9), y la pantalla lee. Aquí se prueba qué se puede
 * AFIRMAR sobre la ciudad entera a partir de lo que el servidor ya resolvió.
 */

const r = (id: string, situacion: EstadoDeRuta["situacion"], abre = "05:30:00"): EstadoDeRuta => ({
  circuito_id: id, situacion, abre_a: abre, arranca_el: null,
});

describe("cuándo la ciudad está cerrada", () => {
  it("con todas cerradas y la misma hora, lo dice de todas", () => {
    const c = ciudadCerrada([r("a", "cerrado"), r("b", "cerrado")]);
    expect(c).toEqual({ abre: "05:30", todasIgual: true });
    expect(vuelvenEnPalabras(c!)).toBe("Vuelven a las 5:30.");
  });

  it("con horas distintas NO dice la primera como si fuera de todas", () => {
    /*
     * El §D del Marco, en su forma más cara para esta pantalla: «05:30» es un
     * valor correcto —es la primera— y dicho de todas manda a quien toma la de
     * las 09:53 a salir de su casa cuatro horas antes.
     */
    const c = ciudadCerrada([r("a", "cerrado", "05:30:00"), r("b", "cerrado", "09:53:00")]);
    expect(c).toEqual({ abre: "05:30", todasIgual: false });
    expect(vuelvenEnPalabras(c!)).toBe("La primera vuelve a las 5:30.");
  });

  it("con una abierta, la ciudad NO está cerrada", () => {
    expect(ciudadCerrada([r("a", "cerrado"), r("b", "abierto")])).toBeNull();
  });

  it("una que todavía no arranca no cuenta como cerrada", () => {
    /*
     * No ha abierto nunca. Contarla volvería «de noche» a una ciudad cuyo
     * servicio arranca el mes que entra — y lo que hay que decir ahí es que
     * arranca, no que se durmió.
     */
    const c = ciudadCerrada([r("a", "cerrado"), r("b", "por_arrancar")]);
    expect(c).toEqual({ abre: "05:30", todasIgual: true });
  });

  it("si TODAS están por arrancar, no es de noche", () => {
    expect(ciudadCerrada([r("a", "por_arrancar"), r("b", "por_arrancar")])).toBeNull();
  });

  it("sin rutas no es de noche: es una ciudad sin rutas, que es otra pantalla", () => {
    expect(ciudadCerrada([])).toBeNull();
  });

  it("una hora ilegible no inventa una: sin hora que decir, no se dice", () => {
    expect(ciudadCerrada([r("a", "cerrado", "")])).toBeNull();
  });
});

describe("la noche de la ciudad dice la hora sin cero", () => {
  it("«Vuelven a las 5:30», no «05:30»", () => {
    expect(vuelvenEnPalabras({ abre: "05:30", todasIgual: true })).toBe("Vuelven a las 5:30.");
    expect(vuelvenEnPalabras({ abre: "01:00", todasIgual: false })).toBe("La primera vuelve a las 1:00.");
  });
});
