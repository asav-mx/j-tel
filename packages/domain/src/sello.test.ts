import { describe, expect, it } from "vitest";
import {
  SIN_LEDGER,
  lecturaDePasos,
  motivoDelSello,
  ventanaDeLlegada,
  ventanaEnPalabras,
  veredictoEnPalabras,
  type HechoParaLeer,
  type LecturaDelLedger,
} from "./sello.js";

const ZONA = "America/Ciudad_Juarez";
/** 06:45 en Juárez (UTC-6 en septiembre). */
const EXIGIDA = new Date("2026-09-17T12:45:00.000Z");

const hecho = (h: Partial<HechoParaLeer>): HechoParaLeer => ({
  veredicto: "cumplido",
  timing: "a_tiempo",
  llegada: new Date("2026-09-17T12:47:10.000Z"),
  llegadaExigida: EXIGIDA,
  toleranciaMin: 5,
  tardeExcusable: false,
  motivoExcusable: null,
  ...h,
});

const ledger = (l: Partial<LecturaDelLedger>): LecturaDelLedger => ({ ...SIN_LEDGER, emparejado: true, ...l });

describe("el motivo de un cumplido sale del hecho, con la cifra que decidió su timing", () => {
  it("a tiempo: la llegada contra el límite con tolerancia", () => {
    const m = motivoDelSello(hecho({}), SIN_LEDGER, ZONA);
    expect(m.clave).toBe("llego");
    expect(m.corto).toBe("llegó 06:47 · a tiempo");
    expect(m.cifras).toEqual([{ medido: "Llegada 06:47:10", umbral: "límite 06:50:00" }]);
  });

  it("una llegada tarde es Cumplido · tarde, con su cifra — nunca un no cumplido", () => {
    const h = hecho({ timing: "tarde", llegada: new Date("2026-09-17T13:12:41.000Z") });
    const m = motivoDelSello(h, SIN_LEDGER, ZONA);
    expect(veredictoEnPalabras(h.veredicto, h.timing)).toBe("Cumplido · tarde");
    expect(m.corto).toBe("llegó 07:12 · tarde");
    expect(m.cifras).toEqual([{ medido: "Llegada 07:12:41", umbral: "límite 06:50:00" }]);
    expect(m.nota).toBeNull();
  });

  it("temprano se mide contra la llegada exigida menos la tolerancia, que es lo que usó el motor", () => {
    const m = motivoDelSello(hecho({ timing: "temprano", llegada: new Date("2026-09-17T12:20:00.000Z") }), SIN_LEDGER, ZONA);
    expect(m.cifras).toEqual([{ medido: "Llegada 06:20:00", umbral: "ventana desde 06:40:00" }]);
  });

  it("la llegada tarde excusable lo dice con el motivo del sello", () => {
    const m = motivoDelSello(
      hecho({ timing: "tarde", tardeExcusable: true, motivoExcusable: "lluvia_nieve" }),
      SIN_LEDGER,
      ZONA,
    );
    expect(m.nota).toBe("El sello marca la llegada tarde como excusable: Lluvia o nieve.");
  });

  it("sin tolerancia en el sello, el umbral lo declara en vez de calcularlo con la de hoy", () => {
    const m = motivoDelSello(hecho({ toleranciaMin: null }), SIN_LEDGER, ZONA);
    expect(m.cifras[0]!.umbral).toBe("tolerancia no registrada en el sello");
  });

  it("sin hora de llegada en el sello, no se inventa una", () => {
    const m = motivoDelSello(hecho({ llegada: null }), SIN_LEDGER, ZONA);
    expect(m.clave).toBe("sin_hora_de_llegada");
    expect(m.cifras).toEqual([]);
  });

  it("el cumplido no necesita el ledger: no dice «no registrado» aunque el ledger no empareje", () => {
    expect(motivoDelSello(hecho({}), SIN_LEDGER, ZONA).clave).toBe("llego");
  });
});

describe("el motivo de un pendiente y de un no cumplido sale del ledger emparejado", () => {
  it("sin emparejar: «Motivo no registrado en este sello», en los dos", () => {
    for (const veredicto of ["pendiente_evidencia", "no_cumplido"] as const) {
      const m = motivoDelSello(hecho({ veredicto }), SIN_LEDGER, ZONA);
      expect(m.clave).toBe("no_registrado");
      expect(m.largo).toBe("Motivo no registrado en este sello.");
    }
  });

  it("sin un solo punto gana sobre todo lo demás", () => {
    const m = motivoDelSello(
      hecho({ veredicto: "pendiente_evidencia" }),
      ledger({ evidenciaIndisponible: true, decision: { result: "pendiente_evidencia", details: { reason: "llegada_sin_atribucion" } } }),
      ZONA,
    );
    expect(m.clave).toBe("sin_evidencia");
  });

  it("llegada sin atribuir: sin cifra, porque no la decidió un número", () => {
    const m = motivoDelSello(
      hecho({ veredicto: "pendiente_evidencia" }),
      ledger({ decision: { result: "pendiente_evidencia", details: { reason: "llegada_sin_atribucion" } } }),
      ZONA,
    );
    expect(m.clave).toBe("llegada_sin_atribucion");
    expect(m.cifras).toEqual([]);
  });

  it("observación insuficiente: la fracción vista contra la tolerancia de origen", () => {
    const m = motivoDelSello(
      hecho({ veredicto: "pendiente_evidencia" }),
      ledger({
        decision: {
          result: "pendiente_evidencia",
          details: { reason: "observacion_insuficiente", earliestObservedFraction: 0.34, originToleranceFraction: 0.15 },
        },
      }),
      ZONA,
    );
    expect(m.cifras).toEqual([{ medido: "Primer punto al 34 % del trazado", umbral: "tolerancia 15 %" }]);
  });

  it("cobertura insuficiente: sólo las cifras que de verdad fallaron", () => {
    const m = motivoDelSello(
      hecho({ veredicto: "pendiente_evidencia" }),
      ledger({
        cobertura: {
          result: "insuficiente",
          details: { coveragePct: 91.2, minCoveragePct: 80, maxGapMinutes: 30, maxGapMinutesAllowed: 10 },
        },
      }),
      ZONA,
    );
    expect(m.clave).toBe("cobertura_insuficiente");
    expect(m.cifras).toEqual([{ medido: "Hueco mayor 30 min", umbral: "máximo 10 min" }]);
  });

  it("un pendiente emparejado sin razón reconocible tampoco se deduce", () => {
    const m = motivoDelSello(
      hecho({ veredicto: "pendiente_evidencia" }),
      ledger({ cobertura: { result: "suficiente", details: {} } }),
      ZONA,
    );
    expect(m.clave).toBe("no_registrado");
  });

  it("no cumplido: las dos razones del motor", () => {
    const con = (reason: string) =>
      motivoDelSello(hecho({ veredicto: "no_cumplido" }), ledger({ decision: { result: "no_cumplido", details: { reason } } }), ZONA);
    expect(con("ninguna_unidad_coincidio_ruta").clave).toBe("ninguna_unidad_coincidio_ruta");
    expect(con("ninguna_unidad_sirvio").clave).toBe("ninguna_unidad_sirvio");
    expect(con("otra_cosa").clave).toBe("no_registrado");
  });
});

describe("la ventana de llegada se arma con lo sellado", () => {
  it("llegada exigida → límite con tolerancia", () => {
    expect(ventanaEnPalabras(ventanaDeLlegada(EXIGIDA, 5, ZONA))).toBe("06:45–06:50");
  });

  it("sin tolerancia en el sello, lo declara", () => {
    expect(ventanaEnPalabras(ventanaDeLlegada(EXIGIDA, null, ZONA))).toBe("06:45 · tolerancia no registrada");
  });
});

describe("lecturaDePasos", () => {
  it("lee la decisión, la cobertura y la evidencia indisponible", () => {
    const l = lecturaDePasos([
      { step: "inicio", result: "evaluando" },
      { step: "cobertura_evidencia", result: "insuficiente", details: { coveragePct: 40 } },
      { step: "decision", result: "no_cumplido", details: { reason: "ninguna_unidad_sirvio" } },
    ]);
    expect(l.emparejado).toBe(true);
    expect(l.evidenciaIndisponible).toBe(false);
    expect(l.decision?.details.reason).toBe("ninguna_unidad_sirvio");
    expect(l.cobertura?.result).toBe("insuficiente");
  });

  it("pasos mal formados no revientan: lo que no se entiende no se lee", () => {
    expect(lecturaDePasos("basura").decision).toBeNull();
    expect(lecturaDePasos([null, 3, { step: "decision" }]).decision).toEqual({ result: null, details: {} });
  });
});
