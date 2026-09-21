import { describe, it, expect } from "vitest";
import {
  detectarPasosEnRecorrido,
  ventanaEsperada,
  compararRangoContraVentana,
  compararPaso,
  ladoDeLaBanda,
  type PuntoDeTelemetria,
  type ParadaParaDetectar,
} from "./paso-por-parada.js";

/*
 * Un trazado recto de 1 km sobre el ecuador, para que 1° de longitud valga
 * ~111.32 km y las cuentas de metros sean fáciles de verificar a mano.
 * lon de 0.000 a 0.009 ≈ 1 002 m sobre el trazado.
 */
const TRAZADO: Array<[number, number]> = [
  [0.0, 0.0],
  [0.003, 0.0],
  [0.006, 0.0],
  [0.009, 0.0],
];

/** Un punto sobre el trazado a X metros de recorrido, aproximando lon. */
function puntoAMetros(id: string, metros: number, minutosDesdeElInicio: number): PuntoDeTelemetria {
  const lon = metros / 111_320; // metros → grados, en el ecuador.
  return {
    id,
    lat: 0,
    lon,
    recordedAt: new Date(2026, 8, 20, 6, minutosDesdeElInicio, 0),
  };
}

function parada(stopId: string, metros: number): ParadaParaDetectar {
  return { stopId, stopVersionId: `${stopId}-v1`, lat: 0, lon: metros / 111_320 };
}

const CORREDOR_M = 150;

describe("detectarPasosEnRecorrido", () => {
  it("detecta un cruce simple: la parada queda entre dos puntos consecutivos", () => {
    const puntos = [puntoAMetros("p1", 100, 0), puntoAMetros("p2", 300, 1)];
    const paradas = [parada("s1", 200)];

    const pasos = detectarPasosEnRecorrido(puntos, TRAZADO, paradas, CORREDOR_M);

    expect(pasos).toHaveLength(1);
    expect(pasos[0]).toMatchObject({
      stopId: "s1",
      stopVersionId: "s1-v1",
      pingPrevioId: "p1",
      pingSiguienteId: "p2",
      huecoSegundos: 60,
    });
    expect(pasos[0]!.pasoDesde).toEqual(puntos[0]!.recordedAt);
    expect(pasos[0]!.pasoHasta).toEqual(puntos[1]!.recordedAt);
  });

  it("no se salta la parada aunque el hueco entre pings sea enorme — el punto central del Marco", () => {
    // Un hueco de 6 horas (360 min) entre dos puntos que rodean la parada.
    // El detector de radio la perdería; el cruce la encuentra igual.
    const puntos = [puntoAMetros("p1", 0, 0), puntoAMetros("p2", 1000, 360)];
    const paradas = [parada("s1", 500)];

    const pasos = detectarPasosEnRecorrido(puntos, TRAZADO, paradas, CORREDOR_M);

    expect(pasos).toHaveLength(1);
    expect(pasos[0]!.huecoSegundos).toBe(360 * 60);
  });

  it("varias paradas en el mismo intervalo se detectan todas", () => {
    const puntos = [puntoAMetros("p1", 0, 0), puntoAMetros("p2", 900, 1)];
    const paradas = [parada("s1", 200), parada("s2", 500), parada("s3", 800)];

    const pasos = detectarPasosEnRecorrido(puntos, TRAZADO, paradas, CORREDOR_M);

    expect(pasos.map((p) => p.stopId).sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("una parada FUERA del intervalo no se detecta", () => {
    const puntos = [puntoAMetros("p1", 0, 0), puntoAMetros("p2", 300, 1)];
    const paradas = [parada("s1", 500)]; // más adelante de donde llegó el segundo punto.

    expect(detectarPasosEnRecorrido(puntos, TRAZADO, paradas, CORREDOR_M)).toHaveLength(0);
  });

  it("sin avance entre dos puntos (detenido o retrocediendo), no hay cruce", () => {
    const puntos = [puntoAMetros("p1", 300, 0), puntoAMetros("p2", 300, 5)]; // mismo lugar.
    const paradas = [parada("s1", 300)];

    expect(detectarPasosEnRecorrido(puntos, TRAZADO, paradas, CORREDOR_M)).toHaveLength(0);
  });

  it("decisión B: fuera del corredor no genera paso, aunque el avance cruce la parada", () => {
    const lejos: PuntoDeTelemetria = { id: "p1", lat: 0.01, lon: 100 / 111_320, recordedAt: new Date(2026, 8, 20, 6, 0) };
    const lejos2: PuntoDeTelemetria = { id: "p2", lat: 0.01, lon: 300 / 111_320, recordedAt: new Date(2026, 8, 20, 6, 1) };
    // A 0.01° de latitud del trazado (~1112 m), muy fuera del corredor de 150 m.
    const paradas = [parada("s1", 200)];

    expect(detectarPasosEnRecorrido([lejos, lejos2], TRAZADO, paradas, CORREDOR_M)).toHaveLength(0);
  });

  it("una parada justo en la frontera de dos intervalos no se cuenta dos veces", () => {
    const puntos = [puntoAMetros("p1", 0, 0), puntoAMetros("p2", 200, 1), puntoAMetros("p3", 400, 2)];
    const paradas = [parada("s1", 200)]; // exactamente donde cae p2.

    const pasos = detectarPasosEnRecorrido(puntos, TRAZADO, paradas, CORREDOR_M);
    expect(pasos).toHaveLength(1);
    // Cuenta en el PRIMER intervalo que la alcanza (avanceMetros <= p2), no en el segundo.
    expect(pasos[0]!.pingSiguienteId).toBe("p2");
  });

  it("menos de dos puntos, o ninguna parada: no truena, no detecta nada", () => {
    expect(detectarPasosEnRecorrido([puntoAMetros("p1", 0, 0)], TRAZADO, [parada("s1", 100)], CORREDOR_M)).toHaveLength(0);
    expect(detectarPasosEnRecorrido([puntoAMetros("p1", 0, 0), puntoAMetros("p2", 300, 1)], TRAZADO, [], CORREDOR_M)).toHaveLength(0);
  });

  it("el hueco de un intervalo de un solo segundo se guarda correctamente", () => {
    const puntos: PuntoDeTelemetria[] = [
      { id: "p1", lat: 0, lon: 100 / 111_320, recordedAt: new Date("2026-09-20T06:00:00Z") },
      { id: "p2", lat: 0, lon: 300 / 111_320, recordedAt: new Date("2026-09-20T06:00:04Z") },
    ];
    const pasos = detectarPasosEnRecorrido(puntos, TRAZADO, [parada("s1", 200)], CORREDOR_M);
    expect(pasos[0]!.huecoSegundos).toBe(4);
  });
});

describe("ventanaEsperada", () => {
  it("centra en ancla + frecuencia, con tolerancia como porcentaje de la frecuencia", () => {
    const ancla = new Date("2026-09-20T07:00:00Z");
    const v = ventanaEsperada(ancla, 10, 50); // cada 10 min, ±50% = ±5 min
    expect(v.centro).toEqual(new Date("2026-09-20T07:10:00Z"));
    expect(v.desde).toEqual(new Date("2026-09-20T07:05:00Z"));
    expect(v.hasta).toEqual(new Date("2026-09-20T07:15:00Z"));
  });

  it("la misma tolerancia en minutos pesa distinto según la frecuencia — 2 min sobre 10 es 20%, sobre 30 no es nada", () => {
    const ancla = new Date("2026-09-20T07:00:00Z");
    const cada10 = ventanaEsperada(ancla, 10, 20); // ±20% de 10 min = ±2 min
    const cada30 = ventanaEsperada(ancla, 30, 20); // ±20% de 30 min = ±6 min
    expect((cada10.hasta.getTime() - cada10.desde.getTime()) / 60_000).toBe(4);
    expect((cada30.hasta.getTime() - cada30.desde.getTime()) / 60_000).toBe(12);
  });
});

describe("compararRangoContraVentana", () => {
  const ventana = ventanaEsperada(new Date("2026-09-20T07:00:00Z"), 10, 50); // [07:05, 07:15]

  it("el rango que cabe entero dentro sostuvo", () => {
    const r = { pasoDesde: new Date("2026-09-20T07:08:00Z"), pasoHasta: new Date("2026-09-20T07:09:00Z") };
    expect(compararRangoContraVentana(r, ventana)).toBe("sostuvo");
  });

  it("un rango entero ANTES de la ventana se agujeró — llegó temprano", () => {
    const r = { pasoDesde: new Date("2026-09-20T07:00:00Z"), pasoHasta: new Date("2026-09-20T07:01:00Z") };
    expect(compararRangoContraVentana(r, ventana)).toBe("se_agujero");
  });

  it("un rango entero DESPUÉS de la ventana se agujeró — llegó tarde. Misma etiqueta que temprano (9.1b)", () => {
    const r = { pasoDesde: new Date("2026-09-20T07:20:00Z"), pasoHasta: new Date("2026-09-20T07:21:00Z") };
    expect(compararRangoContraVentana(r, ventana)).toBe("se_agujero");
  });

  it("un rango que se traslapa con la orilla es sin_datos, nunca un veredicto a medias", () => {
    const r = { pasoDesde: new Date("2026-09-20T07:03:00Z"), pasoHasta: new Date("2026-09-20T07:07:00Z") };
    expect(compararRangoContraVentana(r, ventana)).toBe("sin_datos");
  });

  it("los bordes exactos de la ventana cuentan como sostuvo (cerrada)", () => {
    const r = { pasoDesde: new Date("2026-09-20T07:05:00Z"), pasoHasta: new Date("2026-09-20T07:15:00Z") };
    expect(compararRangoContraVentana(r, ventana)).toBe("sostuvo");
  });
});

describe("compararPaso — el 'no inventes' en el único lugar donde puede aplicarse", () => {
  const paso = { pasoDesde: new Date("2026-09-20T07:09:00Z"), pasoHasta: new Date("2026-09-20T07:10:00Z") };

  it("con paso anterior y promesa, compara normal", () => {
    const v = compararPaso(paso, {
      pasoAnteriorHasta: new Date("2026-09-20T07:00:00Z"),
      aperturaDeclarada: null,
      frequencyMinutes: 10,
      toleranciaPct: 50,
    });
    expect(v).toBe("sostuvo");
  });

  it("sin paso anterior, usa la apertura declarada como ancla — el primero del día", () => {
    const v = compararPaso(paso, {
      pasoAnteriorHasta: null,
      aperturaDeclarada: new Date("2026-09-20T07:00:00Z"),
      frequencyMinutes: 10,
      toleranciaPct: 50,
    });
    expect(v).toBe("sostuvo");
  });

  it("sin ancla NI apertura: sin_datos, no se inventa un ancla", () => {
    const v = compararPaso(paso, {
      pasoAnteriorHasta: null,
      aperturaDeclarada: null,
      frequencyMinutes: 10,
      toleranciaPct: 50,
    });
    expect(v).toBe("sin_datos");
  });

  it("sin promesa vigente en el instante del paso: sin_datos, no se inventa una frecuencia", () => {
    const v = compararPaso(paso, {
      pasoAnteriorHasta: new Date("2026-09-20T07:00:00Z"),
      aperturaDeclarada: null,
      frequencyMinutes: null,
      toleranciaPct: 50,
    });
    expect(v).toBe("sin_datos");
  });
});

/*
 * El lado de la banda (9.2c/9.3b): la conclusión que `compararRangoContraVentana`
 * deja fuera a propósito. Para el motor, temprano y tarde son el mismo daño
 * (9.1b); para quien tiene el radio en la mano son dos correcciones distintas.
 */
describe("ladoDeLaBanda — el lado que la torre sí necesita", () => {
  const ancla = new Date("2026-09-20T07:00:00Z");
  const ventana = ventanaEsperada(ancla, 10, 50); // [07:05, 07:15]
  const rango = (desde: string, hasta: string) => ({
    pasoDesde: new Date(`2026-09-20T${desde}Z`),
    pasoHasta: new Date(`2026-09-20T${hasta}Z`),
  });

  it("dentro de la banda: EN RANGO", () => {
    expect(ladoDeLaBanda(rango("07:08:00", "07:09:00"), ventana)).toBe("dentro");
  });

  it("intervalo CORTO (pasó antes): es lo que la torre llama ADELANTADA", () => {
    // 1 min después del anterior, contra una banda de 5–15: le pisó los talones.
    expect(ladoDeLaBanda(rango("07:00:30", "07:01:00"), ventana)).toBe("antes");
  });

  it("intervalo LARGO (pasó después): es lo que la torre llama ATRASADA", () => {
    expect(ladoDeLaBanda(rango("07:20:00", "07:21:00"), ventana)).toBe("despues");
  });

  it("a caballo de la orilla tiene nombre propio: no es «sin medición»", () => {
    expect(ladoDeLaBanda(rango("07:03:00", "07:07:00"), ventana)).toBe("a_caballo");
  });

  it("los bordes exactos cuentan como dentro, igual que en la de abajo", () => {
    expect(ladoDeLaBanda(rango("07:05:00", "07:15:00"), ventana)).toBe("dentro");
  });

  it("NO cambia lo que ya sellaba compararRangoContraVentana", () => {
    /*
     * La razón por la que ésta es una función nueva y no un cambio en aquélla:
     * `compararRangoContraVentana` ya escribió veredictos, y moverla movería el
     * significado de filas ya guardadas. Los dos lados siguen dando la misma
     * etiqueta única, como manda el 9.1b.
     */
    const casos = [
      rango("07:08:00", "07:09:00"),
      rango("07:00:30", "07:01:00"),
      rango("07:20:00", "07:21:00"),
      rango("07:03:00", "07:07:00"),
      rango("07:05:00", "07:15:00"),
    ];
    const equivalente = { dentro: "sostuvo", antes: "se_agujero", despues: "se_agujero", a_caballo: "sin_datos" } as const;
    for (const c of casos) {
      expect(compararRangoContraVentana(c, ventana)).toBe(equivalente[ladoDeLaBanda(c, ventana)]);
    }
  });
});
