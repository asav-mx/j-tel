import { describe, expect, it } from "vitest";
import { esFechaCivil, revisarCaptura } from "./captura";

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe("revisar lo que se captura de un papel", () => {
  it("pasa un papel con folio y fechas, y limpia los espacios", () => {
    expect(revisarCaptura(form({ folio: "  GNP-88213 ", emitidoEl: "2025-09-13", venceEl: "2026-09-13", nota: "" }))).toEqual({
      ok: true,
      datos: { folio: "GNP-88213", emitidoEl: "2025-09-13", venceElImpreso: "2026-09-13", nota: null },
    });
  });

  it("sin fecha de vencimiento también pasa: el repositorio la calcula si la regla lo permite", () => {
    expect(revisarCaptura(form({ folio: "V-1", emitidoEl: "2026-03-01", venceEl: "" }))).toMatchObject({
      ok: true,
      datos: { venceElImpreso: null },
    });
  });

  it("no vence antes de emitirse", () => {
    expect(revisarCaptura(form({ emitidoEl: "2026-09-13", venceEl: "2026-09-01" }))).toEqual({
      ok: false,
      error: "El papel no puede vencer antes de emitirse. Revisa las dos fechas.",
    });
  });

  it("una fecha que no existe no pasa", () => {
    expect(esFechaCivil("2026-02-30")).toBe(false);
    expect(esFechaCivil("2028-02-29")).toBe(true);
    expect(revisarCaptura(form({ venceEl: "2026-02-30" })).ok).toBe(false);
  });

  it("un papel vacío no se guarda", () => {
    expect(revisarCaptura(form({ folio: " ", nota: "algo" })).ok).toBe(false);
  });
});
