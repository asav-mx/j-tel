import { describe, expect, it } from "vitest";
import { horarioEnPalabras } from "./horario-en-palabras";

describe("horarioEnPalabras — «Hoy de 5:30 a 22:30» (lámina 2-mapa/03)", () => {
  it("sin cero a la izquierda, como la lámina", () => {
    expect(horarioEnPalabras("05:30:00", "22:30:00")).toBe("Hoy de 5:30 a 22:30");
  });
  it("un servicio que cruza la medianoche se dice tal cual", () => {
    expect(horarioEnPalabras("22:00", "06:00")).toBe("Hoy de 22:00 a 6:00");
  });
  it("inicio igual a fin es todo el día", () => {
    expect(horarioEnPalabras("00:00", "00:00")).toBe("Todo el día");
  });
  it("un dato raro no se inventa en frase", () => {
    expect(horarioEnPalabras("", "22:30")).toBeNull();
  });
});
