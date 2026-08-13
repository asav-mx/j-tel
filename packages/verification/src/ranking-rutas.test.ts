/**
 * Paso 2 · el corredor contra todas las rutas del turno.
 *
 * Lo que vigilan:
 *
 *   1. Que NO gobierne — el veredicto es idéntico con y sin rutas del turno.
 *      Es lo único que hace seguro construirlo antes del paso 3.
 *   2. Que ordene por corredor y sepa cuál es la del servicio.
 *   3. Que **haga visible el empalme**: una unidad que recorrió otra ruta sale
 *      con B alto en ESA y bajo en la contratada. Hoy el motor no puede verlo.
 *   4. Que rankee solo a las que llegaron, y declare el total — un recorte sin
 *      su total esconde.
 */
import { describe, it, expect } from "vitest";
import { rankearRutasDelTurno, verifyService } from "./index.js";
import type { GpsPoint, VerificationInput } from "@jtel/domain";

const T0 = new Date("2026-09-01T12:00:00Z");

/** La geocerca del destino, común a las dos rutas del turno. */
const GEOCERCA = [
  { lat: 31.72, lng: -106.4 },
  { lat: 31.73, lng: -106.4 },
  { lat: 31.73, lng: -106.39 },
  { lat: 31.72, lng: -106.39 },
];

/** Ruta A — sube por el meridiano -106.395 y entra a la geocerca. */
const RUTA_A = Array.from({ length: 20 }, (_, i) => ({
  lat: 31.7 + i * 0.0013,
  lng: -106.395,
}));

/** Ruta B — sube por -106.45, lejos de A, y termina en la misma zona. */
const RUTA_B = Array.from({ length: 20 }, (_, i) => ({
  lat: 31.7 + i * 0.0013,
  lng: -106.45,
}));

const RUTAS = [
  {
    routeShiftId: "rs-a",
    routeId: "r-a",
    nombre: "Ruta A",
    waypoints: RUTA_A,
    esLaDelServicio: true,
  },
  {
    routeShiftId: "rs-b",
    routeId: "r-b",
    nombre: "Ruta B",
    waypoints: RUTA_B,
    esLaDelServicio: false,
  },
];

function punto(imei: string, i: number, lat: number, lng: number): GpsPoint {
  return {
    imei,
    unitId: imei,
    latitude: lat,
    longitude: lng,
    timestamp: new Date(T0.getTime() + i * 60_000),
  } as GpsPoint;
}

/** Recorre la ruta B entera y termina entrando a la geocerca. */
function porLaRutaB(imei: string): GpsPoint[] {
  const camino = RUTA_B.map((w, i) => punto(imei, i, w.lat, w.lng));
  // Y llega al destino, para que cuente como candidata que llegó.
  camino.push(punto(imei, 20, 31.725, -106.395));
  return camino;
}

function entrada(puntos: GpsPoint[], conRutas: boolean): VerificationInput {
  return {
    occurrenceId: "occ-1",
    expectedDeadline: new Date(T0.getTime() + 20 * 60_000),
    toleranceMinutes: 10,
    routeStrictness: "kml_full",
    geofencePolygon: GEOCERCA,
    kmlWaypoints: RUTA_A,
    kmlMatchMinPct: 60,
    kmlCorridorMinPct: 60,
    kmlCorridorMeters: 120,
    evidencePoints: puntos,
    rutasDelTurno: conRutas ? RUTAS : undefined,
  } as VerificationInput;
}

describe("el ranking ordena por corredor", () => {
  it("una unidad que recorrió la ruta B encaja mejor en B que en la contratada", () => {
    const puntos = porLaRutaB("u-b");
    const ranking = rankearRutasDelTurno(puntos, RUTAS, 0.12);

    expect(ranking[0]!.nombre).toBe("Ruta B");
    expect(ranking[0]!.esLaDelServicio).toBe(false);
    // Y la contratada queda por debajo: eso es exactamente lo que hoy no se ve.
    expect(ranking[0]!.corridorPct).toBeGreaterThan(ranking[1]!.corridorPct);
  });

  it("sabe cuál es la del servicio, aunque no sea la primera", () => {
    const ranking = rankearRutasDelTurno(porLaRutaB("u-b"), RUTAS, 0.12);
    expect(ranking.filter((r) => r.esLaDelServicio)).toHaveLength(1);
  });

  it("una ruta sin trazado no entra al ranking — no se inventa un cero", () => {
    const ranking = rankearRutasDelTurno(porLaRutaB("u-b"), [
      ...RUTAS,
      {
        routeShiftId: "rs-c",
        routeId: "r-c",
        nombre: "Sin trazado",
        waypoints: [],
        esLaDelServicio: false,
      },
    ], 0.12);
    expect(ranking.map((r) => r.nombre)).not.toContain("Sin trazado");
  });
});

describe("el paso 2 NO gobierna", () => {
  it("el veredicto es idéntico con y sin las rutas del turno", () => {
    /*
     * La misma evidencia, dos entradas que solo difieren en si se pasan las
     * rutas del turno. Si esta prueba se pone roja sin que nadie encienda el
     * paso 3, el ranking empezó a decidir sin que se decidiera.
     */
    const puntos = porLaRutaB("u-b");
    const sin = verifyService(entrada(puntos, false));
    const con = verifyService(entrada(puntos, true));

    expect(con.status).toBe(sin.status);
    expect(con.observedUnitId).toBe(sin.observedUnitId);
    expect(con.candidateUnits.map((c) => c.servedRoute)).toEqual(
      sin.candidateUnits.map((c) => c.servedRoute),
    );
  });

  it("se anota en el ledger declarando que no gobierna", () => {
    const v = verifyService(entrada(porLaRutaB("u-b"), true));
    const paso = v.ledgerSteps.find((s) => s.step === "ranking_rutas");

    expect(paso).toBeDefined();
    expect(paso!.details!.gobierna).toBe(false);
    expect(paso!.details!.rutasDelTurno).toBe(2);
  });

  it("sin rutas del turno el paso no se escribe, y nada cambia", () => {
    const v = verifyService(entrada(porLaRutaB("u-b"), false));
    expect(v.ledgerSteps.find((s) => s.step === "ranking_rutas")).toBeUndefined();
  });
});

describe("el recorte del ranking declara su total", () => {
  it("rankea solo a las que llegaron, y dice cuántas se evaluaron", () => {
    /*
     * Una que llegó y otra que anduvo lejos sin llegar. Se rankea la primera; el
     * total evaluado viaja al lado — misma ley que el corte del expediente.
     */
    const llego = porLaRutaB("u-llego");
    const noLlego = Array.from({ length: 10 }, (_, i) =>
      punto("u-lejos", i, 31.6 + i * 0.0005, -106.55),
    );
    const v = verifyService(entrada([...llego, ...noLlego], true));
    const d = v.ledgerSteps.find((s) => s.step === "ranking_rutas")!.details!;

    expect(d.candidatasEvaluadas).toBe(2);
    expect(d.candidatasRankeadas).toBe(1);
  });
});
