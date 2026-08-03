import { describe, it, expect } from "vitest";
import { motivoSinEvidencia, explicarMotivo } from "./motivo-sin-evidencia.js";

const fin = new Date("2026-08-03T13:25:00Z");

describe("motivoSinEvidencia", () => {
  it("el archivador ya pasó de la ventana: el camión no transmitió", () => {
    expect(
      motivoSinEvidencia({ finDeVentana: fin, marcaDeAgua: new Date("2026-08-03T14:00:00Z") }),
    ).toBe("sin_senal");
  });

  it("el archivador aún no llega: no se puede juzgar todavía", () => {
    // El caso normal de las primeras horas: media de ~7 h de retraso.
    expect(
      motivoSinEvidencia({ finDeVentana: fin, marcaDeAgua: new Date("2026-08-03T09:00:00Z") }),
    ).toBe("memoria_no_alcanza");
  });

  it("justo en el borde cuenta como cubierta", () => {
    expect(motivoSinEvidencia({ finDeVentana: fin, marcaDeAgua: fin })).toBe("sin_senal");
  });

  it("sin marca de agua NO se inventa motivo", () => {
    // Sin ella no sabemos hasta dónde llegó el archivador. La ausencia
    // declarada vale más que una causa verosímil.
    expect(motivoSinEvidencia({ finDeVentana: fin, marcaDeAgua: null })).toBeNull();
  });
});

describe("explicarMotivo", () => {
  it("cada motivo dice qué hacer, y dicen cosas opuestas", () => {
    // La diferencia que justifica separarlos: uno se arregla esperando y el
    // otro no. Si las dos frases dijeran lo mismo, la distinción no serviría.
    expect(explicarMotivo("memoria_no_alcanza")).toMatch(/se resuelve solo/i);
    expect(explicarMotivo("sin_senal")).toMatch(/no se arregla esperando/i);
    expect(explicarMotivo("memoria_no_alcanza")).not.toBe(explicarMotivo("sin_senal"));
  });
});
