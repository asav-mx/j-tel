import { describe, it, expect } from "vitest";
import { detectarPasosEnRecorrido, type PuntoDeTelemetria, type ParadaParaDetectar } from "./paso-por-parada.js";

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
