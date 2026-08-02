import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusBadge } from "@/components/ui";
import { OccurrenceTable } from "@/components/occurrence-table";
import { motivoTiming } from "@/lib/no-cumplido-motivo";

/**
 * La ley del chip de veredicto, encerrada donde no dependa de que alguien lea
 * un comentario.
 *
 * **El color del chip dice el veredicto y solo el veredicto.** Un cumplido que
 * llegó tarde va VERDE; el "tarde" vive como motivo debajo, en ámbar. Durante
 * meses este componente pintó ámbar el cumplido-tarde, y eso lo hacía leer como
 * `pendiente por evidencia` — otro estado, con otras consecuencias. Era mezclar
 * verificación con enforcement en el único elemento de la interfaz cuyo trabajo
 * es no mezclarlas.
 *
 * "Tarde" no es un cuarto estado ni un color: es un motivo bajo cumplido.
 */

function pintar(status: string | null | undefined): string {
  return renderToStaticMarkup(createElement(StatusBadge, { status }));
}

const AMBAR = "--ambar";
const ROJO = "--rojo";
const VERDE = "--verde";

describe("el color del chip es función del veredicto y de nada más", () => {
  it("cumplido va verde, y no puede resolver a ámbar ni a rojo", () => {
    const html = pintar("cumplido");
    expect(html).toContain(VERDE);
    // La regresión concreta que esta prueba existe para impedir.
    expect(html).not.toContain(AMBAR);
    expect(html).not.toContain(ROJO);
  });

  it("no cumplido va rojo, y solo rojo", () => {
    const html = pintar("no_cumplido");
    expect(html).toContain(ROJO);
    expect(html).not.toContain(VERDE);
    expect(html).not.toContain(AMBAR);
  });

  it("pendiente por evidencia va ámbar, con su nombre completo", () => {
    const html = pintar("pendiente_evidencia");
    expect(html).toContain(AMBAR);
    expect(html).toContain("Pendiente por evidencia");
    expect(html).not.toContain(VERDE);
    expect(html).not.toContain(ROJO);
  });

  /*
   * La defensa estructural: el chip ya no recibe `timing`, así que ningún dato
   * de puntualidad puede alcanzar su color. Si alguien vuelve a agregarle esa
   * prop, TypeScript lo detiene aquí antes que ninguna otra cosa.
   */
  it("no acepta timing: la puntualidad no puede tocar el color", () => {
    // @ts-expect-error `timing` no es —y no debe volver a ser— una prop del chip.
    const conTiming = () => createElement(StatusBadge, { status: "cumplido", timing: "tarde" });
    expect(conTiming).toBeTypeOf("function");
  });

  it("sin veredicto no se pinta chip: es ausencia de estado, no un cuarto estado", () => {
    const html = pintar(null);
    expect(html).toContain("Sin verificar");
    expect(html).not.toContain(VERDE);
    expect(html).not.toContain(AMBAR);
    expect(html).not.toContain(ROJO);
  });
});

/**
 * El motivo lleva su medición Y su umbral. El carrier que se defiende necesita
 * ver por cuánto pasó, y contra qué tolerancia se le midió — y esa tolerancia
 * sale del contrato congelado, jamás de una constante.
 */
describe("el motivo de puntualidad", () => {
  const base = {
    status: "cumplido",
    timing: "tarde",
    expectedDeadline: new Date("2026-07-24T12:50:00Z"),
    observedArrivalAt: new Date("2026-07-24T12:56:00Z"),
  };

  it("dice de cuánto fue y contra qué tolerancia", () => {
    expect(motivoTiming({ ...base, toleranceMinutes: 5 })).toBe(
      "Tarde · 6 min después del deadline · tolerancia del contrato 5 min",
    );
  });

  it("la tolerancia sale del contrato, no de un valor fijo", () => {
    // Mismos hechos, otro contrato: el umbral que se muestra tiene que cambiar.
    expect(motivoTiming({ ...base, toleranceMinutes: 15 })).toContain(
      "tolerancia del contrato 15 min",
    );
    expect(motivoTiming({ ...base, toleranceMinutes: 0 })).toContain(
      "tolerancia del contrato 0 min",
    );
  });

  it("sin tolerancia guardada la omite en vez de inventar un umbral", () => {
    const linea = motivoTiming({ ...base, toleranceMinutes: null });
    expect(linea).toBe("Tarde · 6 min después del deadline");
    expect(linea).not.toContain("tolerancia");
  });

  it("temprano se mide igual, hacia el otro lado", () => {
    expect(
      motivoTiming({
        ...base,
        timing: "temprano",
        observedArrivalAt: new Date("2026-07-24T12:40:00Z"),
        toleranceMinutes: 5,
      }),
    ).toBe("Temprano · 10 min antes del deadline · tolerancia del contrato 5 min");
  });

  it("a tiempo no dice nada: no hay motivo que dar", () => {
    expect(motivoTiming({ ...base, timing: "a_tiempo", toleranceMinutes: 5 })).toBeNull();
  });

  it("no es el motivo de un no cumplido — ese lo escribe su propia función", () => {
    expect(motivoTiming({ ...base, status: "no_cumplido", toleranceMinutes: 5 })).toBeNull();
  });

});

/**
 * El skill reserva el ámbar para "pendiente por evidencia, y **motivos con
 * costo**". Llegar temprano es medición sin consecuencia: pintarla ámbar le
 * inventaría al carrier un costo que el contrato no le pone.
 */
describe("el color del motivo lo decide el costo, no la desviación", () => {
  function fila(timing: "tarde" | "temprano", motivo: string) {
    return renderToStaticMarkup(
      createElement(OccurrenceTable, {
        showMotivo: true,
        rows: [
          {
            id: "1",
            serviceDate: "2026-07-24",
            profileName: "Riberas 9",
            profileCode: "RIBERAS-9-I",
            plantLabel: "—",
            carrierLabel: "—",
            clientLabel: "—",
            status: "cumplido",
            timing,
            observedUnitLabel: "9392",
            motivo: null,
            motivoTiming: motivo,
            detailHref: "/cliente/servicio/1",
          },
        ],
      }),
    );
  }

  it("tarde va en ámbar: es motivo con costo", () => {
    const html = fila("tarde", "Tarde · 6 min después del deadline");
    expect(html).toContain("Tarde · 6 min después del deadline");
    expect(html).toMatch(/text-\[var\(--ambar\)\][^"]*">Tarde/);
  });

  it("temprano va en acero, nunca en ámbar", () => {
    const html = fila("temprano", "Temprano · 10 min antes del deadline");
    expect(html).toContain("Temprano · 10 min antes del deadline");
    expect(html).toMatch(/text-\[var\(--acero\)\][^"]*">Temprano/);
    // El chip sigue verde y el motivo no puede teñir de ámbar la fila.
    expect(html).toContain("--verde");
    expect(html).not.toContain("--ambar");
  });
});
