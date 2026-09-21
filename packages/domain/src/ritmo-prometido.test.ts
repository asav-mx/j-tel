import { describe, it, expect } from "vitest";
import {
  medianaDeMinutos,
  perfilDeLaVuelta,
  colocarRitmoPrometido,
  type TramoMedido,
} from "./ritmo-prometido.js";

/*
 * El ritmo prometido (9.2e). Lo que estas pruebas defienden, sobre todo, es la
 * PROHIBICIÓN: que la referencia no se reparta pareja sobre el corredor, y que
 * sin perfil medido el carril salga vacío en vez de salir inventado.
 */

const A = "pA";
const B = "pB";
const C = "pC";

/** Tres paradas; el tramo C→A cierra la vuelta. */
const tramos = (ab: number[], bc: number[], ca: number[]): TramoMedido[] => [
  { deStopId: A, aStopId: B, minutos: ab },
  { deStopId: B, aStopId: C, minutos: bc },
  { deStopId: C, aStopId: A, minutos: ca },
];

describe("medianaDeMinutos", () => {
  it("sin muestras no hay mediana — null, no cero", () => {
    expect(medianaDeMinutos([])).toBeNull();
  });

  it("un atípico no arrastra la mediana como arrastraría el promedio", () => {
    // Un camión varado 90 min en un crucero, entre cuatro tránsitos normales.
    const muestras = [10, 11, 12, 13, 90];
    expect(medianaDeMinutos(muestras)).toBe(12);
    const promedio = muestras.reduce((a, b) => a + b, 0) / muestras.length;
    expect(promedio).toBeGreaterThan(27); // el promedio sí se va
  });

  it("con número par de muestras promedia las dos de en medio", () => {
    expect(medianaDeMinutos([10, 20])).toBe(15);
  });
});

describe("perfilDeLaVuelta", () => {
  it("encadena los tramos medidos en tiempos acumulados, y cierra la vuelta", () => {
    const p = perfilDeLaVuelta([A, B, C], tramos([10], [15], [20]));
    expect(p.medido).toBe(true);
    if (!p.medido) return;
    expect(p.paradas).toEqual([
      { stopId: A, minutosAcumulados: 0 },
      { stopId: B, minutosAcumulados: 10 },
      { stopId: C, minutosAcumulados: 25 },
    ]);
    expect(p.vueltaMinutos).toBe(45);
  });

  it("UN SOLO TRAMO SIN MEDIR rompe el perfil entero: no hay medio perfil", () => {
    // Sin el tramo que cierra (C→A) no se sabe cuánto dura la vuelta, y los
    // acumulados de ahí en adelante serían mentira con cara de dato.
    const p = perfilDeLaVuelta([A, B, C], [
      { deStopId: A, aStopId: B, minutos: [10] },
      { deStopId: B, aStopId: C, minutos: [15] },
    ]);
    expect(p).toEqual({ medido: false, motivo: "perfil_incompleto", tramosSinMedir: 1 });
  });

  it("sin un solo tránsito medido lo dice distinto: sin_tramos, no perfil_incompleto", () => {
    const p = perfilDeLaVuelta([A, B, C], []);
    expect(p).toEqual({ medido: false, motivo: "sin_tramos", tramosSinMedir: 3 });
  });

  it("un circuito de una sola parada no tiene tramos que medir", () => {
    expect(perfilDeLaVuelta([A], []).medido).toBe(false);
  });
});

describe("colocarRitmoPrometido", () => {
  const perfil = perfilDeLaVuelta([A, B, C], tramos([10], [15], [20]));
  if (!perfil.medido) throw new Error("el perfil de la prueba tiene que estar medido");

  it("NO reparte pareja sobre el corredor: usa los tiempos medidos (9.2e)", () => {
    /*
     * Ésta es la prueba que defiende la prohibición. La vuelta dura 45 min y la
     * referencia lleva 12: un reparto parejo la pondría al 12/45 = 26.7 % del
     * corredor, que con tres paradas caería en el tramo A→B. Con los tiempos
     * medidos va en B→C, porque el tramo A→B se recorre en 10 min y ya pasó.
     */
    const [r] = colocarRitmoPrometido({
      perfil,
      frequencyMinutes: 100, // una sola referencia, para aislar la colocación
      minutosDesdeAperturaDeLaFranja: 12,
    });
    expect(r!.entre).toEqual({ deStopId: B, aStopId: C });
    expect(r!.minutosEnLaVuelta).toBe(12);
    // 2 de los 15 min del tramo B→C.
    expect(r!.fraccionDelTramo).toBeCloseTo(2 / 15, 6);
  });

  it("sale una referencia por cada frecuencia transcurrida desde que abrió la franja", () => {
    // 25 min desde la apertura, cada 10: salieron las de los minutos 0, 10 y 20.
    const rs = colocarRitmoPrometido({
      perfil,
      frequencyMinutes: 10,
      minutosDesdeAperturaDeLaFranja: 25,
    });
    expect(rs.map((r) => r.minutosEnLaVuelta)).toEqual([25, 15, 5]);
  });

  it("la que ya dio la vuelta SALE de la lista, no se queda pegada al final", () => {
    // 50 min desde la apertura y la vuelta dura 45: la primera ya terminó.
    const rs = colocarRitmoPrometido({
      perfil,
      frequencyMinutes: 10,
      minutosDesdeAperturaDeLaFranja: 50,
    });
    expect(rs.every((r) => r.minutosEnLaVuelta < 45)).toBe(true);
    expect(rs.map((r) => r.minutosEnLaVuelta)).toEqual([40, 30, 20, 10, 0]);
  });

  it("recién abierta la franja hay una referencia, en el arranque del corredor", () => {
    const rs = colocarRitmoPrometido({
      perfil,
      frequencyMinutes: 10,
      minutosDesdeAperturaDeLaFranja: 0,
    });
    expect(rs).toHaveLength(1);
    expect(rs[0]).toEqual({
      minutosEnLaVuelta: 0,
      entre: { deStopId: A, aStopId: B },
      fraccionDelTramo: 0,
    });
  });

  it("una frecuencia de cero no produce infinitas referencias", () => {
    expect(
      colocarRitmoPrometido({ perfil, frequencyMinutes: 0, minutosDesdeAperturaDeLaFranja: 30 }),
    ).toEqual([]);
  });

  it("en el tramo que cierra la vuelta, la referencia vuelve a la primera parada", () => {
    const [r] = colocarRitmoPrometido({
      perfil,
      frequencyMinutes: 100,
      minutosDesdeAperturaDeLaFranja: 30, // pasado C (25), en el tramo C→A
    });
    expect(r!.entre).toEqual({ deStopId: C, aStopId: A });
    expect(r!.fraccionDelTramo).toBeCloseTo(5 / 20, 6);
  });
});
