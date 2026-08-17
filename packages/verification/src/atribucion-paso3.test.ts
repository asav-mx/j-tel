/**
 * Paso 3 · la atribución pasa al corredor.
 *
 * ── Qué tiene que morir si el paso se quita ─────────────────────────────────
 *
 * La regla del repo dice que cada paso trae una prueba que muera si el paso se
 * quita, y los pasos 1 y 2 eran fáciles de dejar sin vigilancia porque no
 * cambiaban nada. Éste sí cambia veredictos, así que la trampa es la contraria:
 * una prueba que solo compruebe que «el veredicto se movió» pasaría también si
 * se moviera por el motivo equivocado.
 *
 * Por eso cada caso de aquí fija **qué operando** lo movió:
 *
 *   1. Empate con otra ruta del turno → no se atribuye. Pendiente, no volado.
 *   2. Otra ruta encaja mejor → no se atribuye, y el motivo dice CUÁL.
 *   3. Gana por más que el margen → se atribuye, como siempre.
 *   4. El margen sale de la política, no del código: con margen 0 el mismo
 *      empate SÍ atribuye.
 *   5. A no cambió de papel: sigue rechazando por cobertura, con su motivo.
 *   6. Sin rutas del turno no se inventa una comparación, y el expediente lo
 *      dice en vez de callarlo.
 */
import { describe, it, expect } from "vitest";
import { verifyService } from "./index.js";
import type { GpsPoint, VerificationInput } from "@jtel/domain";

const T0 = new Date("2026-09-01T12:00:00Z");

const GEOCERCA = [
  { lat: 31.72, lng: -106.4 },
  { lat: 31.73, lng: -106.4 },
  { lat: 31.73, lng: -106.39 },
  { lat: 31.72, lng: -106.39 },
];

/** La ruta del servicio. */
const PROPIA = Array.from({ length: 20 }, (_, i) => ({
  lat: 31.7 + i * 0.0013,
  lng: -106.395,
}));

/** Lejos de la propia: una unidad que la recorre no encaja en la contratada. */
const LEJANA = Array.from({ length: 20 }, (_, i) => ({
  lat: 31.7 + i * 0.0013,
  lng: -106.45,
}));

const ruta = (nombre: string, waypoints: typeof PROPIA, esLaDelServicio = false) => ({
  routeShiftId: `rs-${nombre}`,
  routeId: `r-${nombre}`,
  nombre,
  waypoints,
  esLaDelServicio,
});

function punto(imei: string, i: number, lat: number, lng: number): GpsPoint {
  return {
    imei,
    unitId: imei,
    latitude: lat,
    longitude: lng,
    timestamp: new Date(T0.getTime() + i * 60_000),
  } as GpsPoint;
}

/** Recorre la ruta que se le pase y entra a la geocerca del destino. */
function recorre(imei: string, trazado: typeof PROPIA): GpsPoint[] {
  const camino = trazado.map((w, i) => punto(imei, i, w.lat, w.lng));
  camino.push(punto(imei, trazado.length, 31.725, -106.395));
  return camino;
}

function entrada(
  puntos: GpsPoint[],
  rutasDelTurno?: ReturnType<typeof ruta>[],
  margen?: number,
): VerificationInput {
  return {
    occurrenceId: "occ-1",
    expectedDeadline: new Date(T0.getTime() + 20 * 60_000),
    toleranceMinutes: 10,
    routeStrictness: "kml_full",
    geofencePolygon: GEOCERCA,
    kmlWaypoints: PROPIA,
    kmlMatchMinPct: 60,
    kmlCorridorMinPct: 60,
    kmlCorridorMeters: 120,
    evidencePoints: puntos,
    rutasDelTurno,
    corridorAttributionMarginPct: margen,
  } as VerificationInput;
}

const candidata = (v: ReturnType<typeof verifyService>, id: string) =>
  v.candidateUnits.find((c) => c.unitId === id);

const pasoDe = (v: ReturnType<typeof verifyService>, id: string) =>
  v.ledgerSteps.find(
    (s) => s.step === "candidata" && s.details?.unidadId === id,
  );

describe("la atribución la decide el corredor, no la cobertura", () => {
  it("un empate con otra ruta del turno no se resuelve por ruido: no atribuye", () => {
    const puntos = recorre("u", PROPIA);
    const v = verifyService(
      entrada(puntos, [ruta("Propia", PROPIA, true), ruta("Gemela", PROPIA)]),
    );

    // La gemela comparte trazado, así que B da lo mismo en las dos. Ganar por 0
    // no es ganar: es una atribución que el sistema no puede hacer.
    expect(candidata(v, "u")?.servedRoute).toBe(false);
  });

  it("cuando otra ruta encaja mejor, el expediente dice cuál y por cuánto", () => {
    const v = verifyService(
      entrada(recorre("u", PROPIA), [
        ruta("Propia", PROPIA, true),
        ruta("Gemela", PROPIA),
      ]),
    );
    const atribucion = pasoDe(v, "u")?.details?.atribucion as
      | { propia: number; mejorAjena: number; mejorAjenaNombre: string; margen: number; gana: boolean }
      | undefined;

    expect(atribucion).toBeDefined();
    expect(atribucion!.gana).toBe(false);
    expect(atribucion!.mejorAjenaNombre).toBe("Gemela");
    expect(atribucion!.margen).toBe(5);
    // Y el número de la propia queda sellado junto al de la ajena: sin los dos,
    // nadie puede auditar por qué no se atribuyó.
    expect(atribucion!.propia).toBeGreaterThan(0);
  });

  it("el motivo NO se confunde con «no siguió el trazado»", () => {
    const v = verifyService(
      entrada(recorre("u", PROPIA), [
        ruta("Propia", PROPIA, true),
        ruta("Gemela", PROPIA),
      ]),
    );
    const motivos = candidata(v, "u")?.motivos ?? [];
    const compuertas = motivos.map((m) => m.compuerta);

    // Siguió un corredor —el suyo— y lo siguió bien. Lo que falló es de cuál.
    expect(compuertas).toContain("atribucion_de_ruta");
    expect(compuertas).not.toContain("precision_de_corredor");
  });

  it("si gana por más que el margen, atribuye igual que siempre", () => {
    // Solo su ruta en el turno además de una lejana: gana por mucho.
    const v = verifyService(
      entrada(recorre("u", PROPIA), [
        ruta("Propia", PROPIA, true),
        ruta("Lejana", LEJANA),
      ]),
    );

    expect(candidata(v, "u")?.servedRoute).toBe(true);
    const atribucion = pasoDe(v, "u")?.details?.atribucion as { gana: boolean };
    expect(atribucion.gana).toBe(true);
  });
});

describe("el margen es de la política, no del código", () => {
  it("con margen 0, el mismo empate SÍ atribuye", () => {
    const rutas = [ruta("Propia", PROPIA, true), ruta("Gemela", PROPIA)];
    const puntos = recorre("u", PROPIA);

    const conCinco = verifyService(entrada(puntos, rutas, 5));
    const conCero = verifyService(entrada(puntos, rutas, 0));

    expect(candidata(conCinco, "u")?.servedRoute).toBe(false);
    expect(candidata(conCero, "u")?.servedRoute).toBe(true);
  });

  it("el margen aplicado viaja en el expediente, no solo en la política", () => {
    const v = verifyService(
      entrada(recorre("u", PROPIA), [ruta("Propia", PROPIA, true), ruta("Gemela", PROPIA)], 7),
    );
    const atribucion = pasoDe(v, "u")?.details?.atribucion as { margen: number };

    // Un umbral que decidió y no quedó sellado es un umbral que nadie puede
    // auditar después. Es la razón de que la perilla viva en la política.
    expect(atribucion.margen).toBe(7);
  });
});

describe("A no cambió de papel", () => {
  it("sigue rechazando por cobertura, con su propio motivo", () => {
    // Recorre solo el primer tercio de su ruta: B alto, A bajo.
    const v = verifyService(
      entrada(recorre("u", PROPIA.slice(0, 6)), [ruta("Propia", PROPIA, true)]),
    );
    const compuertas = (candidata(v, "u")?.motivos ?? []).map((m) => m.compuerta);

    expect(candidata(v, "u")?.servedRoute).toBe(false);
    // El paso 3 movió la atribución, NO la exigencia de cobertura.
    expect(compuertas).toContain("cobertura_de_trazado");
  });
});

describe("sin rutas del turno no se inventa una comparación", () => {
  it("la atribución se resuelve como antes del paso 3", () => {
    const v = verifyService(entrada(recorre("u", PROPIA)));
    expect(candidata(v, "u")?.servedRoute).toBe(true);
  });

  it("y el expediente declara que no se comparó, en vez de callarlo", () => {
    const v = verifyService(entrada(recorre("u", PROPIA)));
    const atribucion = pasoDe(v, "u")?.details?.atribucion as
      | { comparada: boolean; mejorAjena: number | null }
      | undefined;

    // Callarlo dejaría el expediente leyéndose como si el corredor hubiera
    // ganado una comparación que nunca se hizo.
    expect(atribucion?.comparada).toBe(false);
    expect(atribucion?.mejorAjena).toBeNull();
  });
});
