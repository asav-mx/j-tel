import { describe, expect, it } from "vitest";
import { faltantesEnPalabras, reglaEnPalabras, revisarRegla } from "./regla";

const leer = (c: Record<string, string>) => (k: string) => c[k];
const base = { obligatorio: "si", vence: "si", diasDeAviso: "30", periodicidadMeses: "12", nota: "Ley de Transporte de Chihuahua, art. 12" };

describe("revisar la regla que escribe J-Staff", () => {
  it("pasa una regla completa", () => {
    expect(revisarRegla(leer(base))).toEqual({
      ok: true,
      escrita: { regla: { obligatorio: true, vence: true, diasDeAviso: 30, periodicidadMeses: 12 }, nota: base.nota },
    });
  });

  it("sin decidir se guarda como nulo, no como «no»", () => {
    const r = revisarRegla(leer({ ...base, obligatorio: "sin_decidir", vence: "sin_decidir", diasDeAviso: "", periodicidadMeses: "" }));
    expect(r).toMatchObject({ ok: true, escrita: { regla: { obligatorio: null, vence: null, diasDeAviso: null, periodicidadMeses: null } } });
  });

  it("la nota es obligatoria", () => {
    const r = revisarRegla(leer({ ...base, nota: "  " }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("de dónde sale la regla");
  });

  it("días de aviso o periodicidad sin que venza no pasan", () => {
    expect(revisarRegla(leer({ ...base, vence: "no" })).ok).toBe(false);
    expect(revisarRegla(leer({ ...base, vence: "no", diasDeAviso: "", periodicidadMeses: "" })).ok).toBe(true);
  });

  it("los límites atajan un error de dedo", () => {
    expect(revisarRegla(leer({ ...base, diasDeAviso: "3000" })).ok).toBe(false);
    expect(revisarRegla(leer({ ...base, periodicidadMeses: "0" })).ok).toBe(false);
    expect(revisarRegla(leer({ ...base, diasDeAviso: "0" })).ok).toBe(true);
    expect(revisarRegla(leer({ ...base, diasDeAviso: "-1" })).ok).toBe(false);
  });

  it("un campo de tres estados sin elegir no pasa", () => {
    expect(revisarRegla(leer({ ...base, obligatorio: "" })).ok).toBe(false);
  });
});

describe("la regla en palabras", () => {
  it("frase corta y lo que falta", () => {
    expect(reglaEnPalabras({ obligatorio: true, vence: true, diasDeAviso: 15, periodicidadMeses: 6 })).toBe("obligatorio · vence cada 6 meses");
    expect(reglaEnPalabras(null)).toBe("sin regla");
    expect(reglaEnPalabras({ obligatorio: null, vence: null, diasDeAviso: null, periodicidadMeses: null })).toBe("a medio cargar");
    expect(faltantesEnPalabras(["vence", "dias_de_aviso"])).toBe("si vence, los días de aviso");
  });
});
