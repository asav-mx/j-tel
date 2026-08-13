/**
 * La valla del nulo, vista ponerse roja.
 *
 * Regla 8: una defensa que ninguna prueba distingue de su ausencia no cuenta.
 * Como el relleno que esta valla vigila no se puede provocar en producción —ni
 * se debe—, se prueba su veredicto contra estados simulados.
 *
 * Cada caso de aquí es una forma real de perder el nulo, y todas son
 * irreversibles: una vez que un hecho viejo dice algo, nadie puede volver a
 * saber que a esas candidatas nunca se les preguntó.
 */
import { describe, it, expect } from "vitest";
import { evaluarNulos, type EstadoDeLaColumna } from "./verificar-candidatas-nulas.js";

const SANO: EstadoDeLaColumna = {
  columnDefault: null,
  total: 1297,
  nulos: 1297,
  conDato: 0,
  vacios: 0,
  ultimoNulo: new Date("2026-08-13T00:00:00Z"),
  primeroConDato: null,
  viejosConDato: 0,
};

describe("la valla en verde", () => {
  it("el estado real de hoy: 1 297 hechos, todos en nulo, sin default", () => {
    expect(evaluarNulos(SANO)).toEqual([]);
  });

  it("después del despliegue: lo nuevo trae dato y lo viejo sigue en nulo", () => {
    expect(
      evaluarNulos({
        ...SANO,
        conDato: 40,
        nulos: 1297,
        total: 1337,
        // Todo lo que trae dato se selló después de todo lo que no.
        ultimoNulo: new Date("2026-08-13T00:00:00Z"),
        primeroConDato: new Date("2026-08-14T00:00:00Z"),
      }),
    ).toEqual([]);
  });
});

describe("la valla en rojo — cada caso pierde el nulo para siempre", () => {
  it("un default en la columna: lo viejo empezaría a decir «cero candidatas»", () => {
    const p = evaluarNulos({ ...SANO, columnDefault: "'[]'::jsonb" });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain("default");
  });

  it("un relleno hacia atrás: hechos con dato por debajo del corte", () => {
    const p = evaluarNulos({ ...SANO, conDato: 1297, nulos: 0, viejosConDato: 1257 });
    expect(p.some((x) => x.includes("rellenó hacia atrás"))).toBe(true);
  });

  it("el intercalado: un hecho sin dato sellado DESPUÉS de uno con dato", () => {
    const p = evaluarNulos({
      ...SANO,
      conDato: 10,
      // Se selló un hecho sin expediente después del primero que sí lo trae:
      // o el motor dejó de escribirlo, o alguien tocó lo viejo.
      ultimoNulo: new Date("2026-09-01T00:00:00Z"),
      primeroConDato: new Date("2026-08-20T00:00:00Z"),
    });
    expect(p.some((x) => x.includes("DESPUÉS"))).toBe(true);
  });

  it("un '[]' pelón, que el armador nunca produce", () => {
    const p = evaluarNulos({ ...SANO, vacios: 3, conDato: 3 });
    expect(p.some((x) => x.includes("'[]'"))).toBe(true);
  });

  it("y los problemas se acumulan: no reporta solo el primero", () => {
    const p = evaluarNulos({
      ...SANO,
      columnDefault: "'[]'::jsonb",
      vacios: 5,
      conDato: 5,
      viejosConDato: 5,
    });
    expect(p.length).toBeGreaterThanOrEqual(3);
  });
});
