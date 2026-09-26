import { describe, expect, it } from "vitest";
import { tituloArriba } from "./titulo-de-fila";

describe("tituloArriba — nombres largos en la fila de llegada", () => {
  it("un destino corto va junto a la placa, como la lámina 2-mapa/01", () => {
    expect(tituloArriba("hacia Centro")).toBe(false);
    expect(tituloArriba("hacia Centro Norte")).toBe(false);
  });
  it("uno largo sube a su propio renglón", () => {
    expect(tituloArriba("hacia Central de Autobuses Los Ángeles")).toBe(true);
  });
  it("sin título no hay nada que subir", () => {
    expect(tituloArriba(null)).toBe(false);
  });
});
