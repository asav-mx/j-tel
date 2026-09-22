import { describe, expect, it } from "vitest";
import { PISO_DEL_TEXTO, textoSobreLaRuta } from "@/lib/ontoy/tinte-de-ruta";

describe("el texto sobre el color de la ruta (8.8d)", () => {
  it("una ruta amarilla o verde limón voltea a texto oscuro", () => {
    expect(textoSobreLaRuta("#FFB81C").color).toBe("#22282e");
    expect(textoSobreLaRuta("#C6FF00").color).toBe("#22282e");
  });

  it("una ruta morada o azul oscuro lleva texto blanco", () => {
    expect(textoSobreLaRuta("#6B4FA8").color).toBe("#ffffff");
    expect(textoSobreLaRuta("#2F6FA8").color).toBe("#ffffff");
  });

  it("un tono medio, donde ni la tinta ni el blanco alcanzan, cae a negro o blanco puros", () => {
    const r = textoSobreLaRuta("#E0453A");
    expect(["#000000", "#ffffff"]).toContain(r.color);
    expect(r.contraste).toBeGreaterThanOrEqual(PISO_DEL_TEXTO);
  });

  it("NINGÚN color de ruta queda por debajo del piso — barrido del espectro", () => {
    const pasos = [0, 0x33, 0x66, 0x80, 0x99, 0xb8, 0xcc, 0xff];
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    for (const r of pasos)
      for (const g of pasos)
        for (const b of pasos) {
          const color = `#${hex(r)}${hex(g)}${hex(b)}`;
          expect(textoSobreLaRuta(color).contraste, color).toBeGreaterThanOrEqual(PISO_DEL_TEXTO);
        }
  });
});
