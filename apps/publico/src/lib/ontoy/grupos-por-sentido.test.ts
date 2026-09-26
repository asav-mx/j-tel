import { describe, expect, it } from "vitest";
import type { Sentido } from "@/lib/ontoy/forma";
import { gruposPorSentido, tituloDeSentido } from "./grupos-por-sentido";

/**
 * **Lo que esta valla NO prueba.**
 *
 * No prueba que la hoja completa se vea como la lámina, ni que las llegadas de
 * cada sentido sean las correctas: eso es de `llegadasEnSentido` y de la
 * revisión visual. Prueba **cuándo hay dos grupos, cuándo no, y en qué orden**,
 * que es lo que se puede romper editando código sin que ninguna captura lo
 * delate — una hoja con un solo sentido se ve «bien» aunque debiera enseñar dos.
 */

type L = { placa?: string; rotulo: string };
const conUnidad = (u: string): L[] => [{ placa: u, rotulo: "a 2 paradas" }];
const sinUnidad: L[] = [{ rotulo: "Sin unidad a la vista" }];
const NOMBRES: Record<Sentido, string> = { ida: "hacia Centro", vuelta: "hacia Tecnológico" };

const base = {
  sentidoDeLaParada: null as Sentido | null,
  hayTrazado: () => true,
  sentidoActual: "ida" as Sentido,
  llegadasEn: (s: Sentido) => conUnidad(s === "ida" ? "2120" : "2117"),
  nombreDe: (s: Sentido) => NOMBRES[s],
};

describe("cuándo la hoja completa enseña los dos sentidos", () => {
  it("parada de los dos sentidos, con unidades: dos grupos, con sus títulos", () => {
    const g = gruposPorSentido(base);
    expect(g?.map((x) => x.titulo)).toEqual(["Hacia Centro", "Hacia Tecnológico"]);
    expect(g?.map((x) => x.llegadas[0]?.placa)).toEqual(["2120", "2117"]);
  });

  it("parada de UN sentido: nada que agrupar", () => {
    expect(gruposPorSentido({ ...base, sentidoDeLaParada: "ida" })).toBeNull();
    expect(gruposPorSentido({ ...base, sentidoDeLaParada: "vuelta" })).toBeNull();
  });

  it("sin trazado de uno de los dos: no se inventa el grupo que no se puede contar", () => {
    expect(gruposPorSentido({ ...base, hayTrazado: (s) => s === "ida" })).toBeNull();
  });

  it("ningún sentido con unidad medida: no se dice lo mismo dos veces", () => {
    expect(gruposPorSentido({ ...base, llegadasEn: () => sinUnidad })).toBeNull();
  });

  it("basta con que UNO tenga unidad: el otro dice su «sin unidad», que sí es información", () => {
    /* «Hacia Centro viene la 2120» y «Hacia Tecnológico, sin unidad a la
       vista» son dos respuestas distintas, y las dos son verdad. */
    const g = gruposPorSentido({
      ...base,
      llegadasEn: (s) => (s === "ida" ? conUnidad("2120") : sinUnidad),
    });
    expect(g).toHaveLength(2);
    expect(g?.[1]?.llegadas[0]?.rotulo).toBe("Sin unidad a la vista");
  });

  it("el sentido que la hoja traía va PRIMERO", () => {
    expect(gruposPorSentido({ ...base, sentidoActual: "vuelta" })?.map((x) => x.sentido)).toEqual([
      "vuelta",
      "ida",
    ]);
    expect(gruposPorSentido({ ...base, sentidoActual: "ida" })?.map((x) => x.sentido)).toEqual([
      "ida",
      "vuelta",
    ]);
  });
});

describe("el título de un grupo", () => {
  it("con mayúscula al frente, como la lámina", () => {
    expect(tituloDeSentido("hacia Centro", "ida")).toBe("Hacia Centro");
  });

  it("sin destino que nombrar, «Ida» o «Vuelta» — nunca un número de ruta", () => {
    expect(tituloDeSentido(null, "ida")).toBe("Ida");
    expect(tituloDeSentido(null, "vuelta")).toBe("Vuelta");
  });
});
