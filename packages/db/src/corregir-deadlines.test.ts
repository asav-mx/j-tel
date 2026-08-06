import { describe, it, expect } from "vitest";
import { generarSql, ventanaCorregida, type Fila } from "./corregir-deadlines.js";
import { windowForOccurrence } from "./ventana-ocurrencia.js";
import type { ContractPolicy, EvidenceWindowRoute } from "@jtel/domain";

/** Política mínima que el esquema acepta; cada prueba le pone lo suyo encima. */
const POLITICA_BASE = {
  toleranceMinutes: 5,
  arrivalAnticipationMinutes: 15,
  routeStrictness: "kml_full",
  timeZone: "America/Ciudad_Juarez",
  excusableReasons: [],
  enforcementRules: [],
  permitirConsolidacion: false,
  evidenceMinCoveragePct: 80,
  evidenceMaxGapMinutes: 10,
  kmlMatchMinPct: 60,
  kmlCorridorMeters: 120,
  kmlCorridorMinPct: 60,
  kmlOriginToleranceFraction: 0.15,
  maxRouteDurationMinutes: 60,
} as unknown as ContractPolicy;

const fila = (over: Partial<Fila> = {}): Fila => ({
  occurrenceId: "11111111-1111-1111-1111-111111111111",
  contrato: "Contrato X",
  serviceDate: "2026-08-09",
  guardado: new Date("2026-08-09T06:45:00.000Z"),
  correcto: new Date("2026-08-09T12:45:00.000Z"),
  causa: "zona",
  difMinutos: 360,
  tripId: "22222222-2222-2222-2222-222222222222",
  ventana: {
    inicio: new Date("2026-08-09T11:45:00.000Z"),
    fin: new Date("2026-08-09T13:30:00.000Z"),
  },
  bloqueo: null,
  ...over,
});

describe("el SQL que se pega en la consola", () => {
  const sql = generarSql([fila()], false);

  it("lleva las guardas del deadline DENTRO del WHERE", () => {
    // No basta con que el plan fuera seguro al calcularlo: tiene que seguir
    // siéndolo cuando alguien lo corra media hora después.
    expect(sql).toContain("o.expected_deadline > now()");
    expect(sql).toContain("FROM compliance_facts cf WHERE cf.service_occurrence_id = o.id");
  });

  it("lleva las guardas del viaje DENTRO del WHERE", () => {
    expect(sql).toContain("t.evidence_status = 'en_espera'");
    expect(sql).toContain("FROM evidence_points ep WHERE ep.trip_id = t.id");
    expect(sql).toContain("cf.service_occurrence_id = t.service_occurrence_id");
  });

  it("va en transacción y deja la verificación antes del COMMIT", () => {
    expect(sql.indexOf("BEGIN;")).toBeLessThan(sql.indexOf("descuadradas"));
    expect(sql.indexOf("descuadradas")).toBeLessThan(sql.indexOf("COMMIT;"));
    expect(sql).toContain("ROLLBACK;");
  });

  it("los instantes van en UTC explícito, sin ambigüedad de zona", () => {
    expect(sql).toContain("'2026-08-09T12:45:00.000Z'::timestamptz");
    expect(sql).not.toMatch(/'\d{4}-\d{2}-\d{2} \d{2}:\d{2}/); // nada sin la Z
  });

  it("una fila por ocurrencia, en los tres bloques", () => {
    const muchas = [fila(), fila({ occurrenceId: "33333333-3333-3333-3333-333333333333" })];
    const s = generarSql(muchas, false);
    expect((s.match(/11111111-1111-1111-1111-111111111111/g) ?? []).length).toBe(2); // update + verificación
    expect(s).toContain("Ocurrencias a corregir: 2");
  });

  it("declara en el encabezado si la deriva entra o no", () => {
    expect(generarSql([fila()], false)).toContain("deriva incluida: no");
    expect(generarSql([fila({ causa: "deriva" })], true)).toContain("deriva incluida: sí");
  });

  it("una ocurrencia sin viaje no rompe el bloque de viajes", () => {
    const s = generarSql([fila(), fila({ tripId: null, ventana: null })], false);
    expect(s).toContain("BEGIN;");
    expect(s).not.toContain("null::uuid");
    expect(s).toContain("viajes_corregidos");
  });

  it("si NINGUNA tiene viaje, no emite un VALUES vacío", () => {
    // Un VALUES sin filas es SQL inválido, y esto se pega a mano en una
    // consola: tiene que salir correcto o no salir.
    const s = generarSql([fila({ tripId: null, ventana: null })], false);
    expect(s).not.toMatch(/VALUES\s*\n\s*\), aplicado/);
    expect(s).not.toContain("viajes_corregidos");
    expect(s).toContain("ninguna de estas ocurrencias tiene viaje");
  });

  it("sin nada que corregir no emite una transacción vacía", () => {
    expect(generarSql([], false)).not.toContain("BEGIN;");
  });
});

/*
 * La ventana corregida — el defecto del #258.
 *
 * El guion llamaba a `computeEvidenceWindow` SIN su tercer argumento y con una
 * política de tres campos armada a mano. Eso produce una ventana `basis:
 * "politica"` —un fijo antes del deadline— mientras el generador escribe una
 * DERIVADA por ruta. Corregir así movía el deadline bien y dejaba la ventana
 * corta por delante.
 *
 * Estas pruebas fallan contra el código roto: se comprobó por mutación,
 * volviendo a la llamada vieja.
 */
describe("la ventana corregida es la misma que escribe el generador", () => {
  const politica = {
    ...POLITICA_BASE,
    evidenceMarginMinutesBefore: 60,
    verificationGraceMinutes: 15,
    evidenceMarginMinutesAfter: 30,
    maxWindowBeforeMinutes: 360,
    windowSlackPct: 25,
    routeAvgSpeedKmh: 20,
    windowDerivationEnabled: true,
    routeDurationPercentile: 90,
    routeDurationMinSamples: 3,
  } as ContractPolicy;

  const deadline = new Date("2026-08-31T21:15:00.000Z");

  it("con historia medida, la ventana se DERIVA y no se queda en el piso", () => {
    // 100 min de recorrido + 25 % de holgura = 125 min antes, no los 60 del piso.
    const sizing: EvidenceWindowRoute = {
      measuredDurationMinutes: 100,
      routeLengthKm: null,
    };
    const v = ventanaCorregida(deadline, politica, sizing);

    expect(v.basis).toBe("medida");
    expect(v.beforeMinutes).toBe(125);
    // Lo que el código roto devolvía, y que ninguna otra prueba distinguía:
    expect(v.beforeMinutes).toBeGreaterThan(politica.evidenceMarginMinutesBefore);
    expect(v.windowStart.toISOString()).toBe("2026-08-31T19:10:00.000Z");
  });

  it("sin historia, se estima con la geometría del trazado", () => {
    const sizing: EvidenceWindowRoute = {
      measuredDurationMinutes: null,
      routeLengthKm: 27.9,
    };
    const v = ventanaCorregida(deadline, politica, sizing);

    expect(v.basis).toBe("estimada_geometria");
    expect(v.beforeMinutes).toBeGreaterThan(politica.evidenceMarginMinutesBefore);
  });

  it("sin ruta ni historia cae al piso de la política — y lo DICE", () => {
    // Este es el único caso en que el fijo es correcto, y se distingue por
    // `basis`. El defecto era que TODAS las correcciones salían así.
    const v = ventanaCorregida(deadline, politica, {
      measuredDurationMinutes: null,
      routeLengthKm: null,
    });
    expect(v.basis).toBe("politica");
    expect(v.beforeMinutes).toBe(60);
  });

  it("es exactamente lo que el generador escribe, no algo parecido", () => {
    const sizing: EvidenceWindowRoute = {
      measuredDurationMinutes: 100,
      routeLengthKm: 27.9,
    };
    expect(ventanaCorregida(deadline, politica, sizing)).toEqual(
      windowForOccurrence(deadline, politica, sizing),
    );
  });

  it("una política incompleta NO compila — la valla es el compilador", () => {
    const sizing: EvidenceWindowRoute = {
      measuredDurationMinutes: 100,
      routeLengthKm: null,
    };
    // Exactamente la llamada que tenía el defecto: tres campos sueltos.
    // Si alguien vuelve a aflojar el tipo a `Partial<ContractPolicy>`, este
    // `@ts-expect-error` deja de tener error y **`tsc` falla**. Vitest no
    // typechequea (regla 12), así que la que atrapa esto es `pnpm build`.
    // @ts-expect-error política incompleta: faltan las perillas de derivación
    ventanaCorregida(deadline, {
      evidenceMarginMinutesBefore: 60,
      verificationGraceMinutes: 15,
      evidenceMarginMinutesAfter: 30,
    }, sizing);

    // Y el tercer argumento no es opcional: omitirlo era la otra mitad.
    // @ts-expect-error falta el dimensionado de la ruta
    ventanaCorregida(deadline, politica);
  });
});
