import { describe, expect, it } from "vitest";
import { armarActaDelHecho } from "@jtel/domain";
import { lecturaDelActa, SIN_ACTA_EN_PALABRAS, unidadEnPalabras } from "./acta-del-sello";

const PUNTOS = [
  { recordedAt: new Date("2026-09-23T18:00:00Z"), latitude: 31.74, longitude: -106.47 },
  { recordedAt: new Date("2026-09-23T18:00:30Z"), latitude: 31.741, longitude: -106.471 },
];

const ACTA = armarActaDelHecho({
  ventana: { desde: new Date("2026-09-23T17:45:00Z"), hasta: new Date("2026-09-23T18:15:00Z") },
  unidadObservada: { economico: "2120", placas: "ABC-123" },
  unidadDeReferencia: null,
  nombres: { perfil: "Oasis-Centro", planta: "Planta 47" },
  estadoDelViaje: "cerrado",
  puntos: PUNTOS,
});

describe("qué gobierna el expediente", () => {
  it("con acta, el origen es el acta", () => {
    const r = lecturaDelActa({ actaSnapshot: ACTA }, PUNTOS);
    expect(r.origen).toBe("acta");
    expect(r.acta?.nombres.planta).toBe("Planta 47");
  });

  /*
   * Los 2 593 hechos anteriores. Lo que se enseña son datos de hoy, y eso
   * **se dice**: un expediente que los enseña sin avisar afirma que así se
   * juzgó, que es exactamente C24.
   */
  it("sin acta, el origen es hoy — y hay una frase para decirlo", () => {
    const r = lecturaDelActa({ actaSnapshot: null }, PUNTOS);
    expect(r.origen).toBe("hoy");
    expect(r.acta).toBeNull();
    expect(SIN_ACTA_EN_PALABRAS).toContain("datos de hoy");
  });

  it("sin hecho tampoco revienta", () => {
    expect(lecturaDelActa(null, PUNTOS).origen).toBe("hoy");
    expect(lecturaDelActa(undefined, []).origen).toBe("hoy");
  });

  /*
   * `jsonb` llega sin garantía de forma: una fila escrita por una versión
   * anterior del motor no tiene por qué cumplir el tipo.
   */
  it("un acta con forma rara se trata como si no hubiera", () => {
    expect(lecturaDelActa({ actaSnapshot: { cualquier: "cosa" } }, PUNTOS).origen).toBe("hoy");
    expect(lecturaDelActa({ actaSnapshot: "texto" }, PUNTOS).origen).toBe("hoy");
  });
});

describe("el cotejo del contorno llega hasta la pantalla", () => {
  it("con los mismos puntos, cuadra", () => {
    expect(lecturaDelActa({ actaSnapshot: ACTA }, PUNTOS).contorno).toEqual({ que: "cuadra" });
  });

  it("si la evidencia de hoy no es la de entonces, lo dice", () => {
    const r = lecturaDelActa({ actaSnapshot: ACTA }, PUNTOS.slice(0, 1));
    expect(r.contorno.que).toBe("no_cuadra");
  });

  /* Un hueco no es un visto bueno. */
  it("sin acta el contorno dice «sin_acta», no «cuadra»", () => {
    expect(lecturaDelActa(null, PUNTOS).contorno).toEqual({ que: "sin_acta" });
  });
});

describe("la unidad, en palabras", () => {
  it("con placas las pone entre paréntesis", () => {
    expect(unidadEnPalabras({ economico: "2120", placas: "ABC-123" })).toBe("2120 (ABC-123)");
  });

  /* Sin placas no inventa paréntesis vacíos. */
  it("sin placas, sólo el económico", () => {
    expect(unidadEnPalabras({ economico: "2120", placas: null })).toBe("2120");
  });

  it("sin unidad, nada", () => {
    expect(unidadEnPalabras(null)).toBeNull();
  });
});
