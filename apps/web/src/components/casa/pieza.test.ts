import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Pieza } from "@/components/casa/pieza";

/**
 * La flecha › dice «esto lleva a otra pantalla». Si aparece donde no se navega,
 * promete un viaje que no ocurre; si falta donde sí, el celular —sin hover— no
 * tiene cómo saberlo.
 */

const base = { nombre: "10254", apoyo: "en ruta", dato: "hace 14 s", etiqueta: "última señal", edad: null };
const pintar = (extra: Record<string, unknown>) => renderToStaticMarkup(createElement(Pieza, { ...base, ...extra }));

describe("la flecha ›", () => {
  it("la lleva la pieza que abre una ficha, escondida para el lector de pantalla", () => {
    const html = pintar({ ficha: "/casa/transportista/expedientes/unidad/u1" });
    expect(html).toContain("›");
    expect(html).toMatch(/aria-hidden="true"[^>]*>›/);
  });

  it("no la lleva la que sólo señala en la misma pantalla", () => {
    expect(pintar({ alTocar: () => {} })).not.toContain("›");
  });

  it("no la lleva la que no es tocable", () => {
    expect(pintar({})).not.toContain("›");
  });
});
