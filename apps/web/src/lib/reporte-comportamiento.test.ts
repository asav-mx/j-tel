import { describe, expect, it } from "vitest";
import type { TrazadoParaMedir } from "@jtel/domain";
import { agruparHistorial, armarReporte, type UnidadDelHistorial } from "./reporte-comportamiento";

const IDA: TrazadoParaMedir = {
  sentido: "ida",
  coordenadas: [
    [-106.4200, 31.7000],
    [-106.4100, 31.7000],
    [-106.4000, 31.7000],
  ],
};

const T0 = new Date("2026-09-03T12:00:00Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);
const enFraccion = (f: number, m: number) => ({
  lat: 31.7,
  lon: -106.42 + 0.02 * f,
  recordedAt: min(m),
});

/** Un recorrido completo en 11 muestras. */
const recorrido = (desde: number, dura: number) =>
  Array.from({ length: 11 }, (_, i) => enFraccion(i / 10, desde + (dura * i) / 10));

const base = {
  desde: T0,
  hasta: min(600),
  corteDelArchivo: min(590),
  trazados: [IDA],
  corredorMetros: 150,
  frecuenciaDeclaradaMin: null as number | null,
};

describe("armarReporte", () => {
  it("cuenta las vueltas por sentido y no las colapsa en un número", () => {
    /*
     * Sumar ida y vuelta en una sola cifra perdería lo único que distingue un
     * día sano de uno roto: tres de ida y cero de vuelta se vería igual que
     * tres y tres. Es la §D en su forma de REDUCCIÓN.
     */
    const historial: UnidadDelHistorial[] = [
      { unitId: "u1", unitLabel: "6284", puntos: [...recorrido(0, 40), ...recorrido(50, 40)] },
    ];
    const r = armarReporte({ ...base, historial });

    expect(r.unidades[0].porSentido).toHaveLength(1);
    expect(r.unidades[0].porSentido[0]).toMatchObject({ sentido: "ida", vueltas: 2 });
    expect(r.unidades[0].porSentido[0].minutosMediana).toBeCloseTo(36, 0);
  });

  it("LA UNIDAD SIN UN SOLO PUNTO SE CONSERVA, con su hueco enunciado", () => {
    const historial: UnidadDelHistorial[] = [
      { unitId: "u1", unitLabel: "6284", puntos: recorrido(0, 40) },
      { unitId: "u2", unitLabel: "9385", puntos: [] },
    ];
    const r = armarReporte({ ...base, historial });

    expect(r.enElPlan).toBe(2);
    expect(r.conSenal).toBe(1);
    const callada = r.unidades.find((u) => u.unitLabel === "9385")!;
    expect(callada.puntos).toBe(0);
    expect(callada.primeraSenal).toBeNull();
    expect(callada.ultimaSenal).toBeNull();
  });

  it("lo que cayó fuera del corredor se cuenta UNA vez, no una por sentido", () => {
    const conVuelta = { ...base, trazados: [IDA, { ...IDA, sentido: "vuelta" as const }] };
    const historial: UnidadDelHistorial[] = [
      {
        unitId: "u1",
        unitLabel: "6284",
        puntos: [
          enFraccion(0.2, 0),
          { lat: 31.7300, lon: -106.41, recordedAt: min(5) }, // fuera de los DOS
          enFraccion(0.6, 10),
        ],
      },
    ];
    const r = armarReporte({ ...conVuelta, historial });
    // Un solo punto fuera, no dos: el mismo punto cae fuera de ambos trazados.
    expect(r.unidades[0].fueraDelCorredor).toBe(1);
  });

  it("EL CORTE DEL ARCHIVO viaja aparte de la hora del reloj", () => {
    /*
     * «Las vueltas de hoy» siempre significa «hasta donde el archivo alcanzó».
     * Sin este dato la pantalla afirmaría sobre el día completo lo que sólo vale
     * hasta el último punto archivado.
     */
    const r = armarReporte({ ...base, historial: [] });
    expect(r.corteDelArchivo).toEqual(min(590));
    expect(r.hasta).toEqual(min(600));
    expect(r.corteDelArchivo!.getTime()).toBeLessThan(r.hasta.getTime());
  });

  it("el intervalo sale de pasadas de UNIDADES DISTINTAS por el punto de control", () => {
    const historial: UnidadDelHistorial[] = [
      { unitId: "u1", unitLabel: "6284", puntos: recorrido(0, 40) },
      { unitId: "u2", unitLabel: "9385", puntos: recorrido(20, 40) },
      { unitId: "u3", unitLabel: "9382", puntos: recorrido(40, 40) },
    ];
    const r = armarReporte({ ...base, historial });

    expect(r.intervalosMedidos).toBe(2);
    expect(r.intervaloMedianoMin).toBeCloseTo(20, 0);
  });

  it("CON UNA SOLA UNIDAD NO HAY INTERVALO, y va en nulo", () => {
    const r = armarReporte({
      ...base,
      historial: [{ unitId: "u1", unitLabel: "6284", puntos: recorrido(0, 40) }],
    });
    expect(r.intervalosMedidos).toBe(0);
    expect(r.intervaloMedianoMin).toBeNull();
  });

  it("SIN FRECUENCIA DECLARADA el reporte no escoge un número", () => {
    /*
     * La `0031` le quitó el `DEFAULT 20` a la columna justo porque «declaró 20»
     * y «no declaró nada» eran indistinguibles. Decir «va atrasada» contra una
     * frecuencia que nadie declaró es la misma falta, del lado del
     * concesionario en vez del pasajero.
     */
    const r = armarReporte({ ...base, historial: [] });
    expect(r.frecuenciaDeclaradaMin).toBeNull();
  });

  it("con frecuencia declarada, el número viaja tal cual — sin veredicto pegado", () => {
    const r = armarReporte({ ...base, frecuenciaDeclaradaMin: 20, historial: [] });
    expect(r.frecuenciaDeclaradaMin).toBe(20);
    // Y nada en el reporte califica: no hay «atrasada» que buscar.
    expect(JSON.stringify(r)).not.toMatch(/atrasad|adelantad|cumpl/i);
  });

  it("sin trazado no se mide nada, y se dice", () => {
    const r = armarReporte({
      ...base,
      trazados: [],
      historial: [{ unitId: "u1", unitLabel: "6284", puntos: recorrido(0, 40) }],
    });
    expect(r.sinTrazado).toBe(true);
    expect(r.unidades[0].porSentido).toEqual([]);
    expect(r.intervaloMedianoMin).toBeNull();
  });
});

describe("agruparHistorial", () => {
  const plan = [
    { unitId: "u1", unitLabel: "6284" },
    { unitId: "u2", unitLabel: "9385" },
  ];

  it("LAS DEL PLAN SIN ARCHIVO NO DESAPARECEN: la consulta las pierde y aquí vuelven", () => {
    /*
     * La consulta une contra `telemetry_points`, así que una unidad sin un solo
     * punto no produce filas. Desaparecida se lee como que no está asignada, y
     * ese renglón es justo el que el operador necesita ver.
     */
    const filas = [
      { unitId: "u1", unitLabel: "6284", latitude: 31.7, longitude: -106.41, recordedAt: min(0) },
    ];
    const h = agruparHistorial(filas, plan);

    expect(h).toHaveLength(2);
    expect(h.find((u) => u.unitLabel === "9385")!.puntos).toEqual([]);
  });

  it("ordena por número económico, que es como el operador las nombra", () => {
    const h = agruparHistorial([], [
      { unitId: "u3", unitLabel: "9385" },
      { unitId: "u1", unitLabel: "10249" },
      { unitId: "u2", unitLabel: "6284" },
    ]);
    expect(h.map((u) => u.unitLabel)).toEqual(["10249", "6284", "9385"]);
  });

  it("una unidad con archivo que ya no está en el plan igual se enseña", () => {
    // Cambió de circuito a media jornada: sus puntos existen y esconderlos
    // dejaría un hueco sin explicación en el intervalo del día.
    const filas = [
      { unitId: "uX", unitLabel: "7777", latitude: 31.7, longitude: -106.41, recordedAt: min(0) },
    ];
    const h = agruparHistorial(filas, plan);
    expect(h.map((u) => u.unitLabel).sort()).toEqual(["6284", "7777", "9385"]);
  });
});
