import { describe, expect, it } from "vitest";
import { ordenarFilas, titularTrabajan, type FilaUnidad } from "./unidades-explorador-data";

const unidad = (label: string, campos: Partial<FilaUnidad> = {}): FilaUnidad => ({
  id: label,
  label,
  placa: null,
  activa: true,
  diasConServicio: 0,
  servicios: 0,
  ultimoDato: null,
  ultimoDatoTexto: null,
  litros: 0,
  costoDiesel: 0,
  enTaller: false,
  ...campos,
});

describe("titularTrabajan", () => {
  it("afirma cuántas cubrieron, no cuántas no", () => {
    expect(titularTrabajan(37, 82)).toBe("37 de 82 unidades cubrieron servicios contratados.");
  });

  it("nunca enuncia el complemento como un hecho sobre la flota", () => {
    // El caso §D que motivó esto: "45 de 82 unidades no cubrieron ningún
    // servicio" tomaba el denominador de la flota del transportista y el
    // numerador de la demanda de los clientes contratados. J-Telemetry no sabe
    // qué hicieron esas 45 — solo que no fue un servicio que él mide.
    for (const [cubrieron, total] of [[0, 82], [37, 82], [82, 82]] as const) {
      const t = titularTrabajan(cubrieron, total);
      expect(t).not.toMatch(/no cubrieron/i);
      expect(t).not.toMatch(/sin servicio/i);
      expect(t).not.toMatch(/parada|detenida|ociosa|desaprovechada/i);
      // Y siempre dice contra qué universo habla.
      expect(t).toMatch(/contratado/);
    }
  });

  it("con cero cubiertas sigue sin acusar", () => {
    expect(titularTrabajan(0, 82)).toBe("0 de 82 unidades cubrieron servicios contratados.");
  });
});

describe("ordenarFilas", () => {
  const flota = [
    unidad("A", { diasConServicio: 0, litros: 900 }),
    unidad("C", { diasConServicio: 17, litros: 0 }),
    unidad("B", { diasConServicio: 5, litros: 100 }),
  ];

  it("'cuáles trabajan' abre con las que más trabajaron", () => {
    // Estuvo al revés y la tabla abría con cuarenta y cinco ceros: contestaba
    // lo contrario de lo que la lente pregunta.
    expect(ordenarFilas("trabajan", flota).map((f) => f.label)).toEqual(["C", "B", "A"]);
  });

  it("ninguna lente filtra: la flota completa está en las tres", () => {
    for (const lente of ["trabajan", "gastan", "fallan"] as const) {
      const r = ordenarFilas(lente, flota);
      expect(r).toHaveLength(flota.length);
      expect(new Set(r.map((f) => f.label))).toEqual(new Set(["A", "B", "C"]));
    }
  });

  it("no muta el arreglo que recibe", () => {
    const antes = flota.map((f) => f.label);
    ordenarFilas("trabajan", flota);
    expect(flota.map((f) => f.label)).toEqual(antes);
  });

  it("'cuáles gastan' ordena por litros, y 'cuáles fallan' por silencio", () => {
    expect(ordenarFilas("gastan", flota).map((f) => f.label)).toEqual(["A", "B", "C"]);
    const conFecha = [
      unidad("vieja", { ultimoDato: new Date("2026-07-01T00:00:00Z") }),
      unidad("nueva", { ultimoDato: new Date("2026-08-02T00:00:00Z") }),
      unidad("nunca"),
    ];
    expect(ordenarFilas("fallan", conFecha).map((f) => f.label)).toEqual([
      "nunca",
      "vieja",
      "nueva",
    ]);
  });

  it("empate resuelto por nombre, para que el orden no baile entre cargas", () => {
    const empatadas = [unidad("Z", { diasConServicio: 3 }), unidad("A", { diasConServicio: 3 })];
    expect(ordenarFilas("trabajan", empatadas).map((f) => f.label)).toEqual(["A", "Z"]);
  });
});
