import { describe, expect, it } from "vitest";
import {
  contraQueEnPalabras,
  conteoDeVueltasEnPalabras,
  diaVecino,
  estadoDeVueltaEnPalabras,
  faltanEnPalabras,
  intervaloEnPalabras,
} from "./jornada";

describe("las palabras de la jornada (9.3c)", () => {
  it("incompleta dice dónde salió — o entró — del corredor", () => {
    const salio = { tipo: "salio_del_corredor" as const, stopId: "p3", nombre: "Catedral" };
    expect(estadoDeVueltaEnPalabras({ estado: "incompleta", faltan: [{ donde: "final", paradas: [], desde: new Date(), hasta: new Date(), causa: salio }] })).toBe(
      "Incompleta · salió del corredor en Catedral",
    );
    const entro = { tipo: "entro_al_corredor" as const, stopId: "p3", nombre: "Oasis" };
    expect(estadoDeVueltaEnPalabras({ estado: "incompleta", faltan: [{ donde: "principio", paradas: [], desde: new Date(), hasta: new Date(), causa: entro }] })).toBe(
      "Incompleta · entró al corredor en Oasis",
    );
  });

  it("las demás, con sus palabras exactas", () => {
    expect(estadoDeVueltaEnPalabras({ estado: "completa", faltan: [] })).toBe("Completa");
    expect(estadoDeVueltaEnPalabras({ estado: "sin_datos", faltan: [] })).toBe("SIN DATOS");
    expect(estadoDeVueltaEnPalabras({ estado: "paradas_sin_paso", faltan: [] })).toBe("Paradas sin paso");
    expect(estadoDeVueltaEnPalabras({ estado: "todavia_no_se_mide", faltan: [] })).toBe("Todavía no se mide");
  });

  it("«cortó» no existe en ninguna frase", () => {
    const todas = [
      estadoDeVueltaEnPalabras({ estado: "incompleta", faltan: [{ donde: "final", paradas: [], desde: new Date(), hasta: new Date(), causa: { tipo: "salio_del_corredor", stopId: "p", nombre: "X" } }] }),
      faltanEnPalabras({ donde: "final", paradas: [{ stopId: "a", nombre: "A" }], desde: new Date(), hasta: new Date(), causa: { tipo: "sin_datos" } }),
    ].join(" ");
    expect(todas).not.toMatch(/cort/i);
  });

  it("lo que falta se lista, con su causa y sin adjetivo cuando no hay causa medida", () => {
    expect(
      faltanEnPalabras({
        donde: "medio",
        paradas: [{ stopId: "a", nombre: "Zaragoza" }, { stopId: "b", nombre: "Tecnológico" }],
        desde: new Date(),
        hasta: new Date(),
        causa: { tipo: "sin_causa_medida" },
      }),
    ).toBe("Faltan Zaragoza y Tecnológico · sin causa medida");
  });
});

describe("el intervalo es del SERVICIO, no un veredicto de la unidad (ASAV, 22-sep)", () => {
  it("se dice como intervalo, nunca como adelantada / atrasada", () => {
    expect(intervaloEnPalabras("en_rango")).toBe("intervalo en rango");
    expect(intervaloEnPalabras("adelantada")).toBe("intervalo corto");
    expect(intervaloEnPalabras("atrasada")).toBe("intervalo largo");
    expect(intervaloEnPalabras("sin_datos")).toBe("intervalo sin datos");
  });

  it("dice contra quién se midió", () => {
    expect(contraQueEnPalabras("2107", "u2", "u1")).toBe("vs. el paso anterior (2107)");
    expect(contraQueEnPalabras("2120", "u1", "u1")).toBe("vs. su propio paso anterior");
    expect(contraQueEnPalabras(null, null, "u1")).toBe("vs. la apertura del día");
  });
});

describe("el resumen y el selector de día", () => {
  it("cuenta sólo lo que hay", () => {
    expect(conteoDeVueltasEnPalabras({ completa: 7, incompleta: 1, sin_datos: 1, paradas_sin_paso: 0, todavia_no_se_mide: 0 })).toBe(
      "7 completas · 1 incompleta · 1 sin datos",
    );
  });

  it("no deja pasar de hoy", () => {
    expect(diaVecino("2026-09-21", -1, "2026-09-22")).toBe("2026-09-20");
    expect(diaVecino("2026-09-21", 1, "2026-09-22")).toBe("2026-09-22");
    expect(diaVecino("2026-09-22", 1, "2026-09-22")).toBeNull();
    expect(diaVecino("2026-03-01", -1, "2026-09-22")).toBe("2026-02-28");
  });
});
