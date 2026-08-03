import { describe, expect, it } from "vitest";
import { AUSENTES, SIN_PROGRAMADOS } from "./monitoreo-carrier-data";

describe("el día sin operación", () => {
  it("no dice que todo está en orden", () => {
    // "Sin servicios programados" y "todo en orden" son afirmaciones distintas.
    // Confundirlas le diría al transportista que está cumpliendo cuando no hay
    // nada que cumplir — la misma distinción que sostiene la tira de 14 días.
    const todo = Object.values(SIN_PROGRAMADOS).join(" ");
    expect(todo).not.toMatch(/en orden(?!:)/i);
    expect(todo).not.toMatch(/todo bien|sin problemas|al día/i);
  });

  it("nombra lo que sí pasa: que no hay nada programado", () => {
    expect(SIN_PROGRAMADOS.titular).toMatch(/sin servicios programados/i);
    expect(SIN_PROGRAMADOS.nota).toMatch(/no hay nada que cumplir/i);
  });

  it("no usa vocabulario de veredicto", () => {
    const todo = Object.values(SIN_PROGRAMADOS).join(" ");
    expect(todo).not.toMatch(/veredicto|cumplido|no cumplido|pendiente por evidencia/i);
  });
});

describe("lo que la sala no puede decir todavía", () => {
  it("cada renglón ausente trae su razón, ninguno en silencio", () => {
    expect(AUSENTES.length).toBeGreaterThan(0);
    for (const a of AUSENTES) {
      expect(a.titulo.trim().length).toBeGreaterThan(0);
      // Una razón de una línea no es una razón: tiene que decir qué falta.
      expect(a.razon.trim().length).toBeGreaterThan(60);
    }
  });

  it("el kilómetro muerto declara POR QUÉ no se muestra, no solo que falta", () => {
    // No se quitó por costo —se midió en 1.16 s— sino porque el número acusaría
    // en falso: §D del Marco, eje del ALCANCE.
    const km = AUSENTES.find((a) => /kil[óo]metro muerto/i.test(a.titulo));
    expect(km).toBeDefined();
    expect(km!.razon).toMatch(/89\.5%/);
    expect(km!.razon).toMatch(/fuera de lo contratado/i);
  });

  it("ningún renglón ausente se disculpa ni promete fecha", () => {
    for (const a of AUSENTES) {
      expect(a.razon).not.toMatch(/pr[óo]ximamente|pronto|en construcci[óo]n|perd[óo]n/i);
    }
  });
});
