import { describe, expect, it } from "vitest";
import type { LedgerStep } from "@jtel/domain";
import {
  candidataDecisiva,
  candidatasDeLosPasos,
  coberturaDeLosPasos,
  leerElMotor,
  medidasDe,
  porQueDecidio,
  umbralesDeLosPasos,
} from "./diagnostico-lectura";

/**
 * Un paso `candidata` con la forma VIEJA — la que sella el motor antes de C15,
 * con la unidad escondida bajo `imei:`. Se conserva a propósito: es la forma de
 * todo lo ya sellado, y la lectura tiene que seguir entendiéndola.
 */
function candidata(
  imei: string,
  vals: {
    a: number;
    b: number;
    sirvio: boolean;
    frechet?: number;
    dir?: number;
    observable?: number;
  },
): LedgerStep {
  return {
    step: "candidata",
    result: vals.sirvio ? "sirvio_ruta" : "no_sirvio",
    details: {
      imei,
      routeMatchPct: vals.a,
      corridorPrecisionPct: vals.b,
      frechetKm: vals.frechet ?? 0.312,
      directionSimilarity: vals.dir ?? 0.94,
      corridorMeters: 120,
      hasKml: true,
      minKmlPct: 60,
      minCorridorPct: 60,
      frechetMaxKm: 0.8,
      shapeOk: true,
      observableFraction: vals.observable ?? 1,
    },
  };
}

const coberturaOk: LedgerStep = {
  step: "cobertura_evidencia",
  result: "suficiente",
  details: {
    coveragePct: 96.4,
    maxGapMinutes: 3.2,
    minCoveragePct: 80,
    maxGapMinutesAllowed: 10,
    pointCountInWindow: 412,
    bestImei: "UNIT-7",
  },
};

describe("lo que el ledger trae", () => {
  it("saca cada candidata con sus seis cifras", () => {
    const pasos = [candidata("UNIT-7", { a: 44.3, b: 96.1, sirvio: false, observable: 0.557 })];
    const [c] = candidatasDeLosPasos(pasos);

    expect(c).toMatchObject({
      clave: "UNIT-7",
      sirvioRuta: false,
      matchRutaPct: 44.3,
      precisionCorredorPct: 96.1,
      fraccionObservable: 0.557,
    });
  });

  it("lee los umbrales del paso de candidata y los completa con el de decisión", () => {
    const pasos: LedgerStep[] = [
      coberturaOk,
      {
        step: "decision",
        result: "cumplido",
        details: { minKmlPct: 60, minCorridorPct: 55, corridorMeters: 150, hasKml: true },
      },
    ];
    const u = umbralesDeLosPasos(pasos);

    // Sin paso `candidata`, los umbrales existen igual: el de decisión los trae.
    expect(u).toMatchObject({
      hayKml: true,
      matchMinPct: 60,
      corredorMinPct: 55,
      corredorMetros: 150,
      coberturaMinPct: 80,
      huecoMaxMinutos: 10,
    });
  });

  it("devuelve null de cobertura cuando el motor no llegó a ese paso", () => {
    expect(coberturaDeLosPasos([candidata("A", { a: 90, b: 90, sirvio: true })])).toBeNull();
  });

  it("no inventa un valor cuando el jsonb trae otra cosa", () => {
    const roto: LedgerStep = {
      step: "candidata",
      result: "no_sirvio",
      details: { imei: "X", routeMatchPct: "44.3", frechetKm: null },
    };
    const [c] = candidatasDeLosPasos([roto]);

    expect(c!.matchRutaPct).toBeNull();
    expect(c!.frechetKm).toBeNull();
  });
});

describe("cuál candidata se lee", () => {
  it("cuando el motor acreditó una, es esa", () => {
    const candidatas = candidatasDeLosPasos([
      candidata("UNIT-1", { a: 95, b: 99, sirvio: true }),
      candidata("UNIT-2", { a: 70, b: 80, sirvio: true }),
    ]);
    const r = candidataDecisiva(candidatas, {
      resultado: "cumplido",
      motivo: null,
      claveObservada: "UNIT-2",
      fraccionMasTempranaObservada: null,
      toleranciaDeOrigen: null,
    });

    // Aunque UNIT-1 mida mejor: la que ganó la nombra el hecho, no el ranking.
    expect(r.candidata!.clave).toBe("UNIT-2");
    expect(r.papel).toBe("gano");
  });

  it("cuando nadie acreditó, toma la más cercana y lo dice", () => {
    const candidatas = candidatasDeLosPasos([
      candidata("UNIT-1", { a: 30, b: 99, sirvio: false }),
      candidata("UNIT-2", { a: 58, b: 92, sirvio: false }),
    ]);
    const r = candidataDecisiva(candidatas, {
      resultado: "no_cumplido",
      motivo: "ninguna_unidad_coincidio_ruta",
      claveObservada: null,
      fraccionMasTempranaObservada: null,
      toleranciaDeOrigen: null,
    });

    expect(r.candidata!.clave).toBe("UNIT-2");
    expect(r.papel).toBe("mas_cercana");
  });
});

describe("las cuatro medidas", () => {
  it("el match declara sobre qué tramo se calculó", () => {
    const [c] = candidatasDeLosPasos([
      candidata("UNIT-7", { a: 78.4, b: 96.1, sirvio: false, observable: 0.557 }),
    ]);
    const medidas = medidasDe(c!, umbralesDeLosPasos([]), null);
    const match = medidas.find((m) => m.clave === "match_ruta")!;

    // Lo que hace entendible el caso donde el camión maneja bien: el número
    // solo no basta, el tramo sobre el que se calificó es la otra mitad.
    expect(match.nota).toContain("55.7%");
    expect(match.nota).toContain("el arranque no se observó");
  });

  it("sobre la ruta completa no cuelga una advertencia que no aplica", () => {
    const [c] = candidatasDeLosPasos([
      candidata("UNIT-7", { a: 91.2, b: 98.0, sirvio: true, observable: 1 }),
    ]);
    const match = medidasDe(c!, umbralesDeLosPasos([]), null).find(
      (m) => m.clave === "match_ruta",
    )!;

    expect(match.nota).toBe("calculado sobre la ruta completa");
  });

  it("si la corrida no selló el tramo, lo dice en vez de suponer la ruta completa", () => {
    const sinFraccion: LedgerStep = {
      step: "candidata",
      result: "no_sirvio",
      details: { imei: "UNIT-7", routeMatchPct: 44.3, corridorPrecisionPct: 96.1, hasKml: true },
    };
    const [c] = candidatasDeLosPasos([sinFraccion]);
    const match = medidasDe(c!, umbralesDeLosPasos([sinFraccion]), null).find(
      (m) => m.clave === "match_ruta",
    )!;

    expect(match.nota).toBe("el ledger de esta corrida no selló sobre qué tramo se calificó");
  });

  it("la cobertura nombra la candidata que midió, escrita para un humano", () => {
    const pasos = [coberturaOk];
    const nota = medidasDe(null, umbralesDeLosPasos(pasos), coberturaDeLosPasos(pasos), (k) =>
      k === "UNIT-7" ? "Bus 12 · ABC-123" : k,
    ).find((m) => m.clave === "cobertura")!.nota;

    // La cobertura la mide el motor con la candidata de mejor señal, que puede
    // no ser aquella cuyo match se está leyendo. Nombrarla evita perseguir un
    // bug que no existe cuando los dos números no coinciden.
    expect(nota).toContain("medida sobre Bus 12 · ABC-123");
  });

  it("la forma es la única donde menos es mejor", () => {
    const [c] = candidatasDeLosPasos([
      candidata("A", { a: 90, b: 90, sirvio: true, frechet: 0.42 }),
    ]);
    const forma = medidasDe(c!, umbralesDeLosPasos([candidata("A", { a: 90, b: 90, sirvio: true })]), null).find(
      (m) => m.clave === "forma",
    )!;

    expect(forma.direccion).toBe("menor_mejor");
    expect(forma.pasa).toBe(true); // 0.42 km ≤ 0.8 km
  });

  it("sin umbral no se supone que pasó", () => {
    const [c] = candidatasDeLosPasos([candidata("A", { a: 90, b: 90, sirvio: true })]);
    const medidas = medidasDe(
      c!,
      { hayKml: true, matchMinPct: null, corredorMinPct: null, corredorMetros: null, frechetMaxKm: null, coberturaMinPct: null, huecoMaxMinutos: null },
      null,
    );

    expect(medidas.find((m) => m.clave === "match_ruta")!.pasa).toBeNull();
    expect(medidas.find((m) => m.clave === "cobertura")!.pasa).toBeNull();
  });
});

describe("por qué el motor decidió lo que decidió", () => {
  const base = {
    pasos: [] as LedgerStep[],
    candidatas: [],
    decisiva: null,
    umbrales: umbralesDeLosPasos([]),
    cobertura: null,
    decision: null,
  };

  it("sin un solo punto: pendiente, y dice que sin evidencia no hay incumplimiento", () => {
    const linea = porQueDecidio({
      ...base,
      pasos: [{ step: "evidencia", result: "indisponible" }],
    });

    expect(linea).toContain("Pendiente por evidencia");
    expect(linea).toContain("Sin evidencia no hay incumplimiento");
  });

  it("cobertura insuficiente: dice que el motor se detuvo antes de mirar la ruta", () => {
    const pasos: LedgerStep[] = [
      {
        step: "cobertura_evidencia",
        result: "insuficiente",
        details: {
          coveragePct: 41.7,
          maxGapMinutes: 74.5,
          minCoveragePct: 80,
          maxGapMinutesAllowed: 10,
        },
      },
    ];
    const linea = porQueDecidio({
      ...base,
      pasos,
      umbrales: umbralesDeLosPasos(pasos),
      cobertura: coberturaDeLosPasos(pasos),
    });

    expect(linea).toContain("41.7%");
    expect(linea).toContain("80.0%");
    expect(linea).toContain("74.5 min");
    expect(linea).toContain("antes de mirar la ruta");
  });

  it("Huertas-B: la ventana abrió con la ruta ya andando", () => {
    const linea = porQueDecidio({
      ...base,
      decision: {
        resultado: "pendiente_evidencia",
        motivo: "observacion_insuficiente",
        claveObservada: null,
        fraccionMasTempranaObservada: 0.45,
        toleranciaDeOrigen: 0.15,
      },
    });

    // Las dos cifras y su relación, en la misma frase: es lo que hoy obliga a
    // correr un script para entenderlo.
    expect(linea).toContain("45.0%");
    expect(linea).toContain("15.0%");
    expect(linea).toContain("la ventana abrió cuando el recorrido ya iba andando");
  });

  it("cuando solo falla el match, no acusa también al corredor", () => {
    const pasos = [candidata("UNIT-7", { a: 44.3, b: 96.1, sirvio: false, observable: 0.557 })];
    const candidatas = candidatasDeLosPasos(pasos);
    const linea = porQueDecidio({
      ...base,
      pasos,
      candidatas,
      decisiva: candidatas[0]!,
      umbrales: umbralesDeLosPasos(pasos),
      decision: {
        resultado: "no_cumplido",
        motivo: "ninguna_unidad_coincidio_ruta",
        claveObservada: null,
        fraccionMasTempranaObservada: null,
        toleranciaDeOrigen: null,
      },
    });

    expect(linea).toContain("pasó el corredor con 96.1%");
    expect(linea).toContain("se quedó en match 44.3%");
    expect(linea).toContain("55.7% de la ruta que la ventana alcanzó a ver");
  });

  it("cumplido: nombra la unidad y sus dos umbrales", () => {
    const pasos = [candidata("UNIT-3", { a: 91.2, b: 98.4, sirvio: true })];
    const candidatas = candidatasDeLosPasos(pasos);
    const linea = porQueDecidio({
      ...base,
      pasos,
      candidatas,
      decisiva: candidatas[0]!,
      umbrales: umbralesDeLosPasos(pasos),
      decision: {
        resultado: "cumplido",
        motivo: null,
        claveObservada: "UNIT-3",
        fraccionMasTempranaObservada: null,
        toleranciaDeOrigen: null,
      },
    });

    expect(linea).toContain("Cumplido: UNIT-3");
    expect(linea).toContain("entró a la geocerca");
    expect(linea).toContain("91.2%");
    expect(linea).toContain("umbral 60.0%");
  });

  it("sin decisión en el ledger, declara el hueco en vez de explicar bonito", () => {
    expect(porQueDecidio(base)).toContain("Medición no disponible");
  });
});

describe("la lectura completa", () => {
  it("arma un caso donde el recorrido es limpio y el resultado sale en contra", () => {
    const pasos: LedgerStep[] = [
      { step: "inicio", result: "evaluando", details: { pointCount: 412 } },
      coberturaOk,
      { step: "evidencia", result: "disponible", details: { count: 412 } },
      candidata("UNIT-7", { a: 44.3, b: 96.1, sirvio: false, observable: 0.557 }),
      candidata("UNIT-9", { a: 12.0, b: 31.4, sirvio: false, observable: 0.44 }),
      {
        step: "decision",
        result: "no_cumplido",
        details: { reason: "ninguna_unidad_coincidio_ruta" },
      },
    ];

    const lectura = leerElMotor(pasos);

    expect(lectura.candidatas).toHaveLength(2);
    expect(lectura.decisiva!.clave).toBe("UNIT-7");
    expect(lectura.papelDeLaDecisiva).toBe("mas_cercana");

    const match = lectura.medidas.find((m) => m.clave === "match_ruta")!;
    const corredor = lectura.medidas.find((m) => m.clave === "precision_corredor")!;
    const cobertura = lectura.medidas.find((m) => m.clave === "cobertura")!;

    // El retrato del caso: precisión y cobertura impecables, match reprobado,
    // y el match calificado sobre poco más de la mitad de la ruta.
    expect(corredor.pasa).toBe(true);
    expect(cobertura.pasa).toBe(true);
    expect(match.pasa).toBe(false);
    expect(lectura.decisiva!.fraccionObservable).toBeCloseTo(0.557, 3);
  });
});

/**
 * C15 · La lectura entiende las dos épocas del expediente, y las distingue.
 *
 * No es compatibilidad por cortesía: hay 973 hechos reales sellados con la
 * forma vieja, y una lectura que solo entendiera la nueva los dejaría a todos
 * sin nombre de candidata. Lo que NO se puede hacer es rellenar el hueco — en
 * las entradas viejas el aparato no se guardó, y decir cuál era sería
 * inventarlo (Marco §E).
 */
describe("C15 · las dos épocas del ledger", () => {
  const pasoNuevo: LedgerStep = {
    step: "candidata",
    result: "sirvio_ruta",
    details: {
      unidadId: "UNIT-7",
      imeis: ["860000000000001", "860000000000009"],
      routeMatchPct: 74.2,
      corridorPrecisionPct: 96.1,
      hasKml: true,
    },
  };

  const pasoViejo: LedgerStep = {
    step: "candidata",
    result: "sirvio_ruta",
    details: { imei: "UNIT-7", routeMatchPct: 74.2, corridorPrecisionPct: 96.1, hasKml: true },
  };

  it("una entrada nueva nombra la unidad y enseña sus aparatos", () => {
    const [c] = candidatasDeLosPasos([pasoNuevo]);

    expect(c!.clave).toBe("UNIT-7");
    expect(c!.imeis).toEqual(["860000000000001", "860000000000009"]);
  });

  it("una entrada vieja sigue nombrando su candidata — 973 hechos dependen de esto", () => {
    const [c] = candidatasDeLosPasos([pasoViejo]);

    expect(c!.clave).toBe("UNIT-7");
  });

  it("una entrada vieja NO inventa aparatos: la lista sale vacía", () => {
    const [c] = candidatasDeLosPasos([pasoViejo]);

    // Vacío significa «no se guardó», no «no hubo aparato». Rellenarlo con la
    // clave —que es una unidad— repetiría C15 en la pantalla.
    expect(c!.imeis).toEqual([]);
    expect(c!.imeis).not.toContain("UNIT-7");
  });

  it("las dos épocas leen la MISMA clave, así que ninguna cifra se mueve", () => {
    const [nueva] = candidatasDeLosPasos([pasoNuevo]);
    const [vieja] = candidatasDeLosPasos([pasoViejo]);

    expect(nueva!.clave).toBe(vieja!.clave);
    expect(nueva!.matchRutaPct).toBe(vieja!.matchRutaPct);
  });

  it("la cobertura prefiere unidadId y cae a bestImei en lo ya sellado", () => {
    const nueva = coberturaDeLosPasos([
      {
        step: "cobertura_evidencia",
        result: "suficiente",
        details: { coveragePct: 91.2, unidadId: "UNIT-7", bestImei: "UNIT-7" },
      },
    ]);
    const vieja = coberturaDeLosPasos([
      {
        step: "cobertura_evidencia",
        result: "suficiente",
        details: { coveragePct: 91.2, bestImei: "UNIT-7" },
      },
    ]);

    expect(nueva!.clave).toBe("UNIT-7");
    expect(vieja!.clave).toBe("UNIT-7");
  });
});
