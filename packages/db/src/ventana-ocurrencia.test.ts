import { describe, it, expect } from "vitest";
import { contractPolicySchema } from "@jtel/domain";
import { routeWindowSizing, windowForOccurrence } from "./ventana-ocurrencia.js";

const politica = contractPolicySchema.parse({
  toleranceMinutes: 5,
  routeStrictness: "kml_full",
});

const DEADLINE = new Date("2026-07-30T12:45:00Z");
const enMinutos = (min: number) => new Date(DEADLINE.getTime() + min * 60_000);

/** Trazado recto de ~29.5 km sobre la misma latitud (el largo de Huertas-B). */
const RUTA_LARGA = Array.from({ length: 60 }, (_, i) => ({
  lat: 31.7,
  lng: -106.6 + i * (0.311 / 59),
}));

const muestras = (...mins: number[]) => mins.map((durationMinutes) => ({ durationMinutes }));

describe("routeWindowSizing", () => {
  it("sin historia entrega solo el largo del trazado", () => {
    const s = routeWindowSizing(RUTA_LARGA, [], politica);

    expect(s.measuredDurationMinutes).toBeNull();
    expect(s.routeLengthKm).toBeCloseTo(29.5, 0);
  });

  it("con historia suficiente entrega el percentil de la política", () => {
    const s = routeWindowSizing(
      RUTA_LARGA,
      muestras(80, 85, 88, 90, 92, 94, 95, 96, 100, 130),
      politica,
    );

    // p90 por rango más cercano sobre 10 muestras = el noveno valor.
    expect(s.measuredDurationMinutes).toBe(100);
  });

  it("respeta el mínimo de muestras del contrato", () => {
    const pocas = routeWindowSizing(RUTA_LARGA, muestras(96, 98), politica);
    expect(pocas.measuredDurationMinutes).toBeNull();

    const exigente = routeWindowSizing(RUTA_LARGA, muestras(96, 98, 100), {
      ...politica,
      routeDurationMinSamples: 10,
    });
    expect(exigente.measuredDurationMinutes).toBeNull();
  });

  it("sin KML no inventa largo", () => {
    expect(routeWindowSizing(null, [], politica).routeLengthKm).toBeNull();
    expect(routeWindowSizing([], [], politica).routeLengthKm).toBeNull();
    expect(routeWindowSizing([{ lat: 31.7, lng: -106.5 }], [], politica).routeLengthKm).toBeNull();
  });
});

describe("windowForOccurrence", () => {
  it("la ruta larga sin historia ya no arranca ciega", () => {
    const sizing = routeWindowSizing(RUTA_LARGA, [], politica);
    const v = windowForOccurrence(DEADLINE, politica, sizing);

    // ~29.5 km ÷ 20 km/h ≈ 88 min → × 1.25 ≈ 111 (el margen fijo era 60).
    expect(v.beforeMinutes).toBeGreaterThan(105);
    expect(v.basis).toBe("estimada_geometria");
  });

  it("con historia manda la duración medida", () => {
    const sizing = routeWindowSizing(RUTA_LARGA, muestras(90, 95, 96), politica);
    const v = windowForOccurrence(DEADLINE, politica, sizing);

    expect(v.basis).toBe("medida");
    expect(v.beforeMinutes).toBe(120); // 96 × 1.25
  });

  it("una ruta corta se queda con el margen del contrato", () => {
    const corta = [
      { lat: 31.7, lng: -106.5 },
      { lat: 31.7, lng: -106.48 },
    ];
    const v = windowForOccurrence(DEADLINE, politica, routeWindowSizing(corta, [], politica));

    expect(v.beforeMinutes).toBe(60);
    expect(v.windowStart.toISOString()).toBe(enMinutos(-60).toISOString());
  });

  it("el lado de después es el de siempre, mida lo que mida la ruta", () => {
    const v = windowForOccurrence(
      DEADLINE,
      politica,
      routeWindowSizing(RUTA_LARGA, muestras(200, 220, 240), politica),
    );

    expect(v.windowEnd.toISOString()).toBe(enMinutos(45).toISOString());
  });
});
