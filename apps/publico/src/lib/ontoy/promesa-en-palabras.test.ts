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
    expect(promesaEnPalabras(p, "ida")).toBe("Frecuencia · cada 10 min");
    expect(promesaEnPalabras(p, "vuelta")).toBe("Frecuencia · cada 30 min");
  });

  it("un sentido sin franja a esta hora no toma la del otro", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: null }, "vuelta")).toBe(
      "Sin frecuencia publicada para esta hora",
    );
  });

  it("la de los dos sentidos: una cifra si coinciden, las dos si no — nunca un promedio", () => {
    expect(promesaEnPalabras({ estado: "declarada", ida: 15, vuelta: 15 }, null)).toBe("Frecuencia · cada 15 min");
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: 30 }, null)).toBe(
      "Frecuencia · ida cada 10 min · vuelta cada 30 min",
    );
    expect(promesaEnPalabras({ estado: "declarada", ida: 10, vuelta: null }, null)).toBe(
      "Frecuencia · ida cada 10 min · vuelta sin frecuencia a esta hora",
    );
  });

  it("mientras no llega, no dice nada", () => {
    expect(promesaEnPalabras(null, "ida")).toBeNull();
  });
});
