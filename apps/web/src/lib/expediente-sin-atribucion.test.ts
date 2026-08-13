/**
 * El expediente sin atribución — la lectura.
 *
 * Lo que vigilan estas pruebas, en orden de importancia:
 *
 *   1. Que un hueco NO se lea como un cero. Es la tercera ley del frente y la
 *      única que, si se rompe, no se nota mirando la pantalla.
 *   2. Que el motivo NO se deduzca cuando no está — deducirlo sale mal en el
 *      91.2 % de los casos y acusa al transportista de una conducta que no hubo.
 *   3. Que el total evaluado viaje siempre, o el corte esconde.
 *   4. Que lo derivado se marque como lectura de hoy y no como sello.
 */
import { describe, it, expect } from "vitest";
import {
  armarExpediente,
  candidatasDelLedger,
  medidasDe,
  motivosDe,
  PISO_CORREDOR_PCT,
  MAX_SIN_LLEGADAS,
} from "./expediente-sin-atribucion";
import type { CandidatasSnapshot } from "@jtel/domain";

const UMBRALES = {
  minKmlPct: 60,
  minCorridorPct: 50,
  originToleranceFraction: 0.15,
};

const SIN_ETIQUETA = () => null;
const SIN_EMPALME = () => null;

/** Una candidata vieja: llegó, tiene A y B, y NADA más. */
const VIEJA = {
  unitId: "u-1",
  arrivalAt: "2026-07-24T11:41:00.000Z",
  servedRoute: false,
  routeMatchPct: 25.4,
  corridorPrecisionPct: 38,
};

describe("un hueco no es un cero", () => {
  it("la cobertura llana ausente sale como `no_preguntado`, nunca como 0", () => {
    const m = medidasDe(VIEJA, UMBRALES).find((x) => x.etiqueta.includes("llana"))!;
    expect(m.valor).toBeNull();
    expect(m.procedencia).toBe("no_preguntado");
    // Lo que no puede pasar nunca:
    expect(m.valor).not.toBe(0);
  });

  it("el tramo observable ausente sale como `no_preguntado`", () => {
    const m = medidasDe(VIEJA, UMBRALES).find((x) => x.etiqueta.includes("observable"))!;
    expect(m.valor).toBeNull();
    expect(m.procedencia).toBe("no_preguntado");
  });

  it("y cuando el dato SÍ está, sale como del sello", () => {
    const m = medidasDe({ ...VIEJA, routeMatchPlainPct: 100, observableFraction: 0.17 }, UMBRALES);
    expect(m.find((x) => x.etiqueta.includes("llana"))!.procedencia).toBe("sello");
    expect(m.find((x) => x.etiqueta.includes("observable"))!.procedencia).toBe("sello");
  });

  it("cada medida trae su umbral al lado — un dato sin su lectura es medio dato", () => {
    const m = medidasDe(VIEJA, UMBRALES);
    expect(m.find((x) => x.etiqueta === "Cobertura del trazado")!.umbral).toBe(60);
    expect(m.find((x) => x.etiqueta === "Precisión de corredor")!.umbral).toBe(50);
  });

  it("una cobertura alta sobre un tramo chico NO se puede leer sola", () => {
    /*
     * El caso que Asav vio en pantalla: candidatas con 100 % sobre un tramo
     * observable de 0.3 %. Medido: de 2 823 candidatas con cobertura ≥ 60 %,
     * 1 791 (63.4 %) la calcularon sobre ≤ 15 % de la ruta, y 1 128 muestran
     * 100 % sobre ≤ 5 %. El número es cierto y no dice nada.
     */
    const m = medidasDe(
      { ...VIEJA, routeMatchPct: 100, observableFraction: 0.003 },
      UMBRALES,
    ).find((x) => x.etiqueta === "Cobertura del trazado")!;
    expect(m.valor).toBe(100);
    // Lo que importa: el número viene con sobre qué se calculó, pegado.
    expect(m.nota).toContain("0.3%");
    expect(m.nota).toContain("SOLO");
  });

  it("y cuando el tramo sí alcanza, la nota lo dice sin alarma", () => {
    const m = medidasDe(
      { ...VIEJA, routeMatchPct: 91, observableFraction: 0.97 },
      UMBRALES,
    ).find((x) => x.etiqueta === "Cobertura del trazado")!;
    expect(m.nota).toContain("97.0% de la ruta");
    expect(m.nota).not.toContain("SOLO");
  });

  it("sin tramo sellado no se inventa sobre qué se calculó", () => {
    const m = medidasDe(VIEJA, UMBRALES).find(
      (x) => x.etiqueta === "Cobertura del trazado",
    )!;
    expect(m.nota).toBe("la que decide · ponderada");
  });

  it("la ponderada se rotula como la que decide — C17", () => {
    const m = medidasDe(VIEJA, UMBRALES).find((x) => x.etiqueta === "Cobertura del trazado")!;
    expect(m.nota).toContain("ponderada");
  });
});

describe("el motivo no se deduce cuando no está", () => {
  it("una candidata vieja sin motivos dice que no se preguntó", () => {
    const motivos = motivosDe(VIEJA, UMBRALES);
    expect(motivos).toHaveLength(1);
    expect(motivos[0]!.procedencia).toBe("no_preguntado");
    expect(motivos[0]!.texto).toContain("no se preguntó");
  });

  it("NO inventa una compuerta comparando números con umbrales", () => {
    // A 25.4 < 60 y B 38 < 50: la tentación es decir «falló A y B». No se hace.
    const motivos = motivosDe(VIEJA, UMBRALES);
    expect(motivos.some((m) => m.texto.includes("No recorrió"))).toBe(false);
    expect(motivos.some((m) => m.texto.includes("No se mantuvo"))).toBe(false);
  });

  it("con motivos sellados los muestra todos, con su población", () => {
    const motivos = motivosDe(
      {
        ...VIEJA,
        motivos: [
          { compuerta: "cobertura_de_trazado", poblacion: "candidata", medido: 25.4, umbral: 60 },
          { compuerta: "precision_de_corredor", poblacion: "candidata", medido: 38, umbral: 50 },
        ],
      },
      UMBRALES,
    );
    expect(motivos).toHaveLength(2);
    expect(motivos.every((m) => m.procedencia === "sello")).toBe(true);
    expect(motivos.every((m) => m.poblacion === "candidata")).toBe(true);
  });

  it("una candidata que acreditó no trae motivos ni la frase de «no se preguntó»", () => {
    expect(motivosDe({ ...VIEJA, servedRoute: true }, UMBRALES)).toEqual([]);
  });
});

describe("el corte y su ley", () => {
  const tres = [
    { ...VIEJA, unitId: "u-1", corridorPrecisionPct: 38 },
    { ...VIEJA, unitId: "u-2", corridorPrecisionPct: 12 },
    { ...VIEJA, unitId: "u-3", arrivalAt: null, corridorPrecisionPct: 0 },
  ];

  it("guarda cuántas se evaluaron en total, no cuántas se muestran", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: tres,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.evaluadas).toBe(3);
    expect(e.candidatas.length).toBeLessThan(e.evaluadas);
  });

  it("cuenta las llegadas sobre TODAS las evaluadas, no sobre la lista recortada", () => {
    /*
     * El error que esto fija se vio en el navegador, no compilando: el titular
     * decía «13 unidades llegaron» en un servicio donde llegaron 15 y pasaron
     * el corte 13. Correcto como conteo, falso como afirmación.
     */
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: [
        { ...VIEJA, unitId: "u-1", corridorPrecisionPct: 38 },
        { ...VIEJA, unitId: "u-2", corridorPrecisionPct: 1 }, // llegó, no pasa el corte
        { ...VIEJA, unitId: "u-3", arrivalAt: null },          // ni llegó
      ],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.llegaron).toBe(2);
    expect(e.candidatas).toHaveLength(1);
    expect(e.evaluadas).toBe(3);
  });

  it("deja fuera a la que no llegó", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: tres,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.candidatas.map((c) => c.clave)).not.toContain("u-3");
  });

  it("si ninguna pasa el piso de corredor, cae a las que llegaron — nunca vacío", () => {
    const rasantes = [
      { ...VIEJA, unitId: "u-a", corridorPrecisionPct: PISO_CORREDOR_PCT - 1 },
      { ...VIEJA, unitId: "u-b", corridorPrecisionPct: 0 },
    ];
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: rasantes,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.candidatas.length).toBe(2);
    expect(e.criterio).toBe("solo_llegada");
  });

  it("ordena por la que más cerca estuvo de acreditar", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: tres,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.candidatas[0]!.clave).toBe("u-1");
  });

  it("sin ninguna candidata evaluada devuelve null", () => {
    expect(
      armarExpediente({
        snapshot: null,
        ledgerCandidatas: [],
        umbrales: UMBRALES,
        etiquetaDe: SIN_ETIQUETA,
        empalmeDe: SIN_EMPALME,
      }),
    ).toBeNull();
  });
});

describe("cuando NINGUNA llegó — «nadie llegó» sigue siendo un hallazgo", () => {
  /*
   * El caso que Asav abrió y que la primera versión no explicaba: 42 candidatas
   * evaluadas, ninguna entró a la geocerca, y la pantalla mostraba una lista
   * vacía bajo «0 unidades llegaron». Son 204 de los 608 acusados.
   */
  const nadieLlego = [
    { unitId: "u-1", arrivalAt: null, routeMatchPct: 18, corridorPrecisionPct: 22 },
    { unitId: "u-2", arrivalAt: null, routeMatchPct: 9, corridorPrecisionPct: 11 },
    { unitId: "u-3", arrivalAt: null, routeMatchPct: 0, corridorPrecisionPct: 0 },
  ];

  it("no deja la lista vacía: muestra las que más se acercaron al trazado", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: nadieLlego,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
      puntosDeLaFlota: 5053,
    })!;
    expect(e.llegaron).toBe(0);
    expect(e.criterio).toBe("sin_llegadas");
    expect(e.candidatas.length).toBeGreaterThan(0);
    // La que más se acercó va primero.
    expect(e.candidatas[0]!.clave).toBe("u-1");
  });

  it("deja fuera a la que no dejó ningún rastro sobre la ruta", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: nadieLlego,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.candidatas.map((c) => c.clave)).not.toContain("u-3");
  });

  it("contesta las tres preguntas del caso: señal, trazado y GPS de la flota", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: nadieLlego,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
      puntosDeLaFlota: 5053,
      senalDe: (clave) =>
        clave === "u-3" ? null : { coberturaPct: 90, huecoMaximoMin: 1, cadenciaMedianaS: 30, puntos: 100 },
    })!;
    expect(e.sinLlegadas).not.toBeNull();
    expect(e.sinLlegadas!.conSenal).toBe(2);
    expect(e.sinLlegadas!.tocaronElTrazado).toBe(2);
    expect(e.sinLlegadas!.puntosDeLaFlota).toBe(5053);
  });

  it("con llegadas, `sinLlegadas` va en null — son dos lecturas distintas", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: [VIEJA],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.sinLlegadas).toBeNull();
  });

  it("tope al listar, y el total evaluado sigue viajando para que el tope no esconda", () => {
    const muchas = Array.from({ length: 42 }, (_, i) => ({
      unitId: `u-${i}`,
      arrivalAt: null,
      routeMatchPct: 42 - i,
      corridorPrecisionPct: 42 - i,
    }));
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: muchas,
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.candidatas).toHaveLength(MAX_SIN_LLEGADAS);
    expect(e.evaluadas).toBe(42);
    // Y las que muestra son las de arriba, no las primeras del arreglo.
    expect(e.candidatas[0]!.clave).toBe("u-0");
  });
});

describe("lo derivado se marca como lectura de hoy", () => {
  it("el empalme nunca se presenta como del sello", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: [VIEJA],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: () => ({ rutaNombre: "Sierra Vista 3", fecha: "2026-07-24" }),
    })!;
    expect(e.candidatas[0]!.empalme!.procedencia).toBe("hoy");
  });

  it("sin empalme no hay renglón — no se escribe «no sirvió otra ruta»", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: [VIEJA],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.candidatas[0]!.empalme).toBeNull();
  });

  it("un expediente del ledger enuncia qué no se preguntó, en palabras", () => {
    const e = armarExpediente({
      snapshot: null,
      ledgerCandidatas: [VIEJA],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.origen).toBe("ledger");
    expect(e.noSePregunto.length).toBeGreaterThan(0);
    expect(e.noSePregunto.some((x) => x.includes("por qué no acreditó"))).toBe(true);
  });
});

describe("cuando el hecho SÍ trae expediente sellado, manda el sello", () => {
  const snapshot: CandidatasSnapshot = {
    evaluadas: 52,
    criterio: "llego_a_geocerca_y_corredor_mayor_5pct",
    candidatas: [
      {
        unidadId: "u-9",
        imeis: ["123"],
        llegadaAt: "2026-09-01T11:41:07.000Z",
        acredito: false,
        motivos: [
          { compuerta: "tramo_observable", poblacion: "candidata", medido: 0.17, umbral: 0.85 },
        ],
        senal: { coberturaPct: 91.2, huecoMaximoMin: 4.5, cadenciaMedianaS: 40, puntos: 210 },
      },
    ],
    trazadoEvaluado: { variantId: "v-1", kmlVersionId: "k-1" },
  };

  it("usa el total sellado y no cuenta las del ledger", () => {
    const e = armarExpediente({
      snapshot,
      ledgerCandidatas: [VIEJA, VIEJA],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.origen).toBe("sello");
    expect(e.evaluadas).toBe(52);
    expect(e.candidatas).toHaveLength(1);
  });

  it("el motivo sellado sale con su población y sin la frase de «no se preguntó»", () => {
    const e = armarExpediente({
      snapshot,
      ledgerCandidatas: [],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    const m = e.candidatas[0]!.motivos[0]!;
    expect(m.procedencia).toBe("sello");
    expect(m.poblacion).toBe("candidata");
    expect(m.texto).toContain("No se le vio suficiente ruta");
  });

  it("y ya no enuncia faltantes: en esta época sí se preguntó", () => {
    const e = armarExpediente({
      snapshot,
      ledgerCandidatas: [],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.noSePregunto).toEqual([]);
  });
});

describe("los 4 sellados con el expediente VACÍO", () => {
  /*
   * Cuatro servicios se sellaron con la lista en blanco antes de que el motor
   * supiera guardar el caso «nadie llegó». El hecho no se reescribe: lo que se
   * enseña se calcula hoy del ledger, que sí tiene las candidatas — 205 de 205
   * las tienen, y 205 de 205 conservan sus puntos.
   */
  const selloVacio: CandidatasSnapshot = {
    evaluadas: 42,
    criterio: "sin_llegadas_mas_cercanas_al_trazado",
    candidatas: [],
    trazadoEvaluado: { variantId: "v-1", kmlVersionId: "k-1" },
  };

  it("cae al ledger en vez de quedarse mudo", () => {
    const e = armarExpediente({
      snapshot: selloVacio,
      ledgerCandidatas: [
        { unitId: "u-1", arrivalAt: null, routeMatchPct: 18, corridorPrecisionPct: 22 },
      ],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.candidatas.length).toBeGreaterThan(0);
  });

  it("se marca como reconstruido — no puede verse igual que lo sellado", () => {
    const e = armarExpediente({
      snapshot: selloVacio,
      ledgerCandidatas: [
        { unitId: "u-1", arrivalAt: null, routeMatchPct: 18, corridorPrecisionPct: 22 },
      ],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.origen).toBe("reconstruido");
  });

  it("conserva el total evaluado DEL SELLO, que sí se congeló", () => {
    const e = armarExpediente({
      snapshot: selloVacio,
      ledgerCandidatas: [
        { unitId: "u-1", arrivalAt: null, routeMatchPct: 18, corridorPrecisionPct: 22 },
      ],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.evaluadas).toBe(42);
  });

  it("un sello vacío SIN ledger utilizable se queda como sello, no inventa", () => {
    const e = armarExpediente({
      snapshot: selloVacio,
      ledgerCandidatas: [],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.origen).toBe("sello");
    expect(e.candidatas).toEqual([]);
  });

  it("y un sello CON candidatas nunca se reconstruye", () => {
    const e = armarExpediente({
      snapshot: {
        ...selloVacio,
        candidatas: [
          {
            unidadId: "u-9",
            imeis: [],
            llegadaAt: null,
            acredito: false,
            motivos: [],
            senal: null,
          },
        ],
      },
      ledgerCandidatas: [{ unitId: "otra", arrivalAt: null, routeMatchPct: 99 }],
      umbrales: UMBRALES,
      etiquetaDe: SIN_ETIQUETA,
      empalmeDe: SIN_EMPALME,
    })!;
    expect(e.origen).toBe("sello");
    expect(e.candidatas[0]!.clave).toBe("u-9");
  });
});

describe("candidatasDelLedger", () => {
  it("toma el último asiento que trae candidatas", () => {
    const c = candidatasDelLedger([
      { createdAt: "2026-07-01T00:00:00Z", metadata: { candidateUnits: [{ unitId: "vieja" }] } },
      { createdAt: "2026-07-02T00:00:00Z", metadata: { candidateUnits: [{ unitId: "nueva" }] } },
      { createdAt: "2026-07-03T00:00:00Z", metadata: {} },
    ]);
    expect(c[0]!.unitId).toBe("nueva");
  });

  it("sin asientos con candidatas devuelve vacío", () => {
    expect(candidatasDelLedger([{ metadata: {} }])).toEqual([]);
  });
});
