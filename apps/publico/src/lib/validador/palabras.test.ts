import { describe, it, expect } from "vitest";
import type { ResultadoDelLector } from "@jtel/domain/validador";
import { detalleDeUnPaseBueno, tituloDeUnPaseBueno } from "./palabras";

const bueno = (
  via: "qr" | "codigo_dictado",
  conSenal: boolean,
): Extract<ResultadoDelLector, { pasa: true }> => ({
  pasa: true,
  folio: "ONT-00042042",
  via,
  conSenal,
});

describe("lo que el panel puede afirmar", () => {
  /*
   * La prueba que existe por un error que estuvo escrito: el panel decía
   * «firma verificada» también en la vía dictada, donde no hay firma alguna.
   */
  it("la vía dictada NUNCA dice que verificó una firma", () => {
    for (const conSenal of [true, false]) {
      const frase = detalleDeUnPaseBueno(bueno("codigo_dictado", conSenal));
      expect(frase.toLowerCase()).not.toContain("firma verificada");
      expect(frase.toLowerCase()).toContain("sin firma que verificar");
    }
  });

  it("la vía dictada se anuncia desde el título", () => {
    expect(tituloDeUnPaseBueno(bueno("codigo_dictado", true))).toContain("código dictado");
    expect(tituloDeUnPaseBueno(bueno("qr", true))).toBe("Válido");
  });

  it("el QR sí verificó, y lo dice en las dos señales", () => {
    expect(detalleDeUnPaseBueno(bueno("qr", true))).toContain("Firma verificada");
    expect(detalleDeUnPaseBueno(bueno("qr", false))).toContain("Firma verificada");
  });

  it("sin señal siempre se dice, entre por donde entre", () => {
    for (const via of ["qr", "codigo_dictado"] as const) {
      expect(detalleDeUnPaseBueno(bueno(via, false)).toLowerCase()).toContain("sin señal");
    }
  });
});
