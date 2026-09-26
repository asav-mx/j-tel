import { describe, expect, it } from "vitest";
import { promesaEnPalabras } from "./llegadas";

describe("promesaEnPalabras — la promesa de las franjas, dicha (8.2, 9.1c)", () => {
  it("sin promesa capturada no inventa cadencia", () => {
    expect(promesaEnPalabras({ estado: "sin_capturar" }, null)).toBe("Esta ruta no publica cada cuánto pasa");
  });

  it("sin franja a esta hora lo dice así, distinto de «no publica»", () => {
    expect(promesaEnPalabras({ estado: "sin_franja" }, "ida")).toBe("Sin frecuencia publicada para esta hora");
  });

  it("la parada de un sentido dice la de SU sentido", () => {
    const p = { estado: "declarada" as const, ida: 10, vuelta: 30 };
    expect(promesaEnPalabras(p, "ida")).toBe("Pasa cada 10 min");
    expect(promesaEnPalabras(p, "vuelta")).toBe("Pasa cada 30 min");
  });

  it("un sentido sin franja a esta hora no toma la del otro", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: null }, "vuelta")).toBe(
      "Sin frecuencia publicada para esta hora",
    );
  });

  it("la de los dos sentidos: una cifra si coinciden, las dos si no — nunca un promedio", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: 15, vuelta: 15 }, null)).toBe("Pasa cada 15 min");
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: 30 }, null)).toBe(
      "Pasa de ida cada 10 min · de vuelta cada 30 min",
    );
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: null }, null)).toBe(
      "Pasa de ida cada 10 min · de vuelta sin frecuencia a esta hora",
    );
  });

  it("mientras no llega, no dice nada", () => {
    expect(promesaEnPalabras(null, "ida")).toBeNull();
  });
});

describe("«Pasa cada…», como la lámina 1/02 (26-sep)", () => {
  it("un número es un número: sin rango inventado", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: 12, vuelta: 12 }, null)).toBe("Pasa cada 12 min");
    expect(promesaEnPalabras({ estado: "declarada", ida: 12, vuelta: 12 }, null)).not.toMatch(/\d+–\d+/);
  });

  it("ida y vuelta vacías no son «iguales»: nunca «cada null min»", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: null, vuelta: null }, null)).toBe(
      "Sin frecuencia publicada para esta hora",
    );
  });
});
