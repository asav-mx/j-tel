import { describe, expect, it } from "vitest";
import { promesaEnPalabras } from "./franja-horaria.js";

/*
 * Las frases que Ontoy le dice al pasajero, fijadas el día que se mudaron al
 * dominio (21-sep-2026). Si una cambia aquí, cambia en Ontoy y en J-Staff a la
 * vez — que es justo el punto.
 */
describe("promesaEnPalabras — la frase de Ontoy, una sola", () => {
  it("las tres respuestas que no se funden", () => {
    expect(promesaEnPalabras({ estado: "sin_capturar" }, null)).toBe("Esta ruta no publica cada cuánto pasa");
    expect(promesaEnPalabras({ estado: "sin_franja" }, null)).toBe("Sin frecuencia publicada para esta hora");
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: 10 }, null)).toBe("Pasa cada 10 min");
  });

  it("ida y vuelta distintas: las dos, nunca un promedio", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: 20 }, null)).toBe(
      "Pasa de ida cada 10 min · de vuelta cada 20 min",
    );
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: null }, null)).toBe(
      "Pasa de ida cada 10 min · de vuelta sin frecuencia a esta hora",
    );
  });

  it("con sentido, sólo la de su sentido; sin dato, null", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: 20 }, "vuelta")).toBe("Pasa cada 20 min");
    expect(promesaEnPalabras(null, null)).toBeNull();
  });
});
