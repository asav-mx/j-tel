import { describe, expect, it } from "vitest";
import { vivoAlDia } from "./vivo-al-dia";
import type { Vivo } from "./forma";

const VIVO = {
  estado: "en_vivo",
  abre_a: "05:30",
  arranca_el: null,
  rango_activo: false,
  unidades: [{ economico: "2120", lat: 31.72, lon: -106.438, rumbo: 0, sentido: "ida", antiguedad_seg: 10, fresco: true }],
} as unknown as Vivo;

describe("vivoAlDia — el Mapa sin señal (a1, 25-sep)", () => {
  it("con señal no toca nada", () => {
    expect(vivoAlDia(VIVO, false, 1_000, 601_000)).toBe(VIVO);
  });
  it("sin señal, la edad sigue con el reloj: 10 s + 10 min", () => {
    expect(vivoAlDia(VIVO, true, 1_000, 601_000).unidades[0].antiguedad_seg).toBe(610);
  });
  it("sin señal ninguna unidad es fresca: no se habla en presente", () => {
    expect(vivoAlDia(VIVO, true, 1_000, 1_000).unidades[0].fresco).toBe(false);
  });
  it("sin hora de la última respuesta, la edad se queda como llegó", () => {
    expect(vivoAlDia(VIVO, true, null, 601_000).unidades[0].antiguedad_seg).toBe(10);
  });
});
