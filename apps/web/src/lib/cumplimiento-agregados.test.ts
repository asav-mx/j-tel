import { describe, expect, it } from "vitest";
import {
  aplicarFiltroResultado,
  contarPeriodo,
  FILTROS_DE_RESULTADO,
  type EstadoDeHecho,
} from "@/lib/cumplimiento-agregados";

/**
 * Dos de los cuatro casos de "un dato correcto que miente" (Marco, sección D),
 * cercados donde no dependan de que alguien lea un comentario.
 */

function occ(estado: EstadoDeHecho | null) {
  return estado ? { complianceFact: { status: estado } } : { complianceFact: null };
}

const PERIODO = [
  occ("cumplido"),
  occ("cumplido"),
  occ("no_cumplido"),
  occ("pendiente_evidencia"),
  occ(null),
];

describe("un agregado dice la verdad del periodo completo, no la del filtro", () => {
  it("cuenta los cinco cortes sobre el mismo universo", () => {
    expect(contarPeriodo(PERIODO)).toEqual({
      total: 5,
      cumplido: 2,
      no_cumplido: 1,
      pendiente: 1,
      sin_verificar: 1,
    });
  });

  /*
   * La regresión concreta —agregados contados DESPUÉS del filtro, de modo que
   * al filtrar a `cumplido` la tarjeta "No cumplidos" mostraba 0— no vivía
   * dentro de esta función: contar siempre contó bien. Vivía en el sitio de
   * llamada, y eso ninguna prueba sobre una función pura lo ve.
   *
   * Por eso la valla es de tipos: lo que sale del filtro va marcado y
   * `contarPeriodo` se niega a recibirlo. Esta prueba comprueba que la valla
   * existe — si alguien la quita, `@ts-expect-error` deja de aplicar y el
   * chequeo de tipos falla.
   */
  it("lo filtrado por resultado NO se puede contar como periodo", () => {
    const lente = aplicarFiltroResultado(PERIODO, "cumplido");

    // @ts-expect-error contarPeriodo rechaza por tipo lo que salió del filtro.
    expect(() => contarPeriodo(lente)).not.toThrow();
  });

  it("la lente sí cambia lo que se lista, que es su único trabajo", () => {
    expect(aplicarFiltroResultado(PERIODO, "cumplido")).toHaveLength(2);
    expect(aplicarFiltroResultado(PERIODO, "no_cumplido")).toHaveLength(1);
    expect(aplicarFiltroResultado(PERIODO, "sin_verificar")).toHaveLength(1);
    expect(aplicarFiltroResultado(PERIODO, "all")).toHaveLength(5);
  });

  it("un periodo vacío cuenta ceros, no se cae", () => {
    expect(contarPeriodo([])).toEqual({
      total: 0,
      cumplido: 0,
      no_cumplido: 0,
      pendiente: 0,
      sin_verificar: 0,
    });
  });
});

describe("los resultados de cara al cliente son tres, y nada más", () => {
  it("el selector ofrece los tres, más «todos»", () => {
    expect(FILTROS_DE_RESULTADO.map((f) => f.id)).toEqual([
      "all",
      "cumplido",
      "no_cumplido",
      "pendiente_evidencia",
    ]);
  });

  /*
   * `sin_verificar` es ausencia de resultado, no un cuarto resultado. En la
   * misma fila de opciones se lee como un cuarto veredicto del que elegir. Se
   * dibuja aparte, con su propia etiqueta; esta prueba impide que vuelva a
   * colarse en la fila.
   */
  it("`sin_verificar` no puede entrar al selector de resultado", () => {
    expect(FILTROS_DE_RESULTADO.map((f) => f.id)).not.toContain("sin_verificar");
    expect(FILTROS_DE_RESULTADO.map((f) => f.label)).not.toContain("Sin verificar");
  });

  it("el pendiente se nombra completo: pendiente de QUÉ es lo que da credibilidad", () => {
    const pendiente = FILTROS_DE_RESULTADO.find((f) => f.id === "pendiente_evidencia");
    expect(pendiente?.label).toBe("Pendiente por evidencia");
  });
});
