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

/** Recorre SU ruta entera y entra a la geocerca: A y B en regla. */
function porLaRutaA(imei: string): GpsPoint[] {
  const camino = RUTA_A.map((w, i) => punto(imei, i, w.lat, w.lng));
  camino.push(punto(imei, 20, 31.725, -106.395));
  return camino;
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

describe("el paso 2 NO gobierna — hasta que el paso 3 lo enciende", () => {
  /*
   * ⚠ **Esta invariante terminó a propósito el 17 de agosto de 2026.**
   *
   * El paso 2 se construyó con la garantía de que el ranking no decidía nada, y
   * esta prueba la vigilaba: mismo veredicto con y sin rutas del turno. Era lo
   * único que hacía seguro construirlo antes del paso 3.
   *
   * El paso 3 es exactamente el momento de romperla: la atribución pasa a B y el
   * ranking empieza a decidir. Por eso la prueba no se borra —borrarla dejaría
   * el repo sin registro de que la garantía existió y de cuándo dejó de valer—
   * sino que **se invierte**: ahora vigila que el ranking SÍ gobierne.
   *
   * Si esta prueba se pone verde en su forma vieja, el paso 3 se apagó.
   */
  it("desde el paso 3, el ranking SÍ mueve el veredicto", () => {
    /*
     * El caso que aísla el cambio, y hubo que construirlo a propósito: una
     * unidad que recorre OTRA ruta falla también A, así que su rechazo no
     * probaría nada del paso 3. Aquí la unidad hace SU ruta entera —A y B en
     * regla— y el turno trae una ruta gemela que comparte el trazado. La propia
     * ya no gana por el margen, y la atribución no se hace.
     */
    const puntos = porLaRutaA("u-a");
    const conGemela = {
      ...entrada(puntos, false),
      rutasDelTurno: [
        RUTAS[0]!,
        { routeShiftId: "rs-g", routeId: "r-g", nombre: "Gemela", waypoints: RUTA_A, esLaDelServicio: false },
      ],
    } as VerificationInput;

    const sin = verifyService(entrada(puntos, false));
    const con = verifyService(conGemela);

    // Sin rutas del turno no hay contra qué comparar: se resuelve como antes.
    expect(sin.candidateUnits.find((c) => c.unitId === "u-a")?.servedRoute).toBe(true);
    // Con la gemela, empata consigo misma y el sistema no puede atribuir.
    expect(con.candidateUnits.find((c) => c.unitId === "u-a")?.servedRoute).toBe(false);
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
