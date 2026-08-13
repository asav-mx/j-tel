/**
 * El expediente de candidatas — Parte 2.
 *
 * Cada prueba de aquí se escribió comprobando que **muere** al quitar lo que
 * protege (regla 8). Lo que vigilan, en orden de importancia:
 *
 *   1. Que el motivo se escriba, y con TODAS las compuertas que fallaron.
 *   2. Que el motivo diga a qué población se le preguntó — C25 en el registro.
 *   3. Que `null` y lista vacía NO se confundan nunca.
 *   4. Que el corte no esconda: el total evaluado viaja siempre.
 *   5. Que ningún veredicto se mueva.
 */
import { describe, it, expect } from "vitest";
import { verifyService } from "@jtel/verification";
import type { GpsPoint, VerificationInput } from "@jtel/domain";
import {
  armarCandidatasSnapshot,
  CRITERIO_RELEVANTE,
  CRITERIO_SOLO_LLEGADA,
  PISO_CORREDOR_RELEVANTE_PCT,
} from "./candidatas-snapshot.js";

/** Un cuadrado de ~1 km alrededor del destino. */
const GEOCERCA = [
  { lat: 31.72, lng: -106.4 },
  { lat: 31.73, lng: -106.4 },
  { lat: 31.73, lng: -106.39 },
  { lat: 31.72, lng: -106.39 },
];

/** Un trazado recto que termina dentro de la geocerca. */
const TRAZADO = Array.from({ length: 20 }, (_, i) => ({
  lat: 31.7 + i * 0.0013,
  lng: -106.395,
}));

const T0 = new Date("2026-09-01T12:00:00Z");

function punto(
  imei: string,
  minuto: number,
  lat: number,
  lng: number,
  unitId?: string,
): GpsPoint {
  return {
    imei,
    unitId,
    latitude: lat,
    longitude: lng,
    timestamp: new Date(T0.getTime() + minuto * 60_000),
  } as GpsPoint;
}

/** Una unidad que recorre el trazado completo y entra a la geocerca. */
function recorridoCompleto(imei: string, unitId: string): GpsPoint[] {
  return TRAZADO.map((w, i) => punto(imei, i, w.lat, w.lng, unitId));
}

/** Una unidad que solo aparece al final, ya dentro de la geocerca. */
function soloLlegada(imei: string, unitId: string): GpsPoint[] {
  return [17, 18, 19].map((i) => punto(imei, i, TRAZADO[i]!.lat, TRAZADO[i]!.lng, unitId));
}

/** Una unidad que anda lejos del trazado y nunca entra a la geocerca. */
function porOtroLado(imei: string, unitId: string): GpsPoint[] {
  return Array.from({ length: 20 }, (_, i) =>
    punto(imei, i, 31.65 + i * 0.0005, -106.5, unitId),
  );
}

/**
 * Arranca sobre el origen del trazado, se va lejos casi todo el recorrido, y
 * vuelve a entrar a la geocerca.
 *
 * Se ve el origen —así que el tramo observable SÍ alcanza— y aun así falla las
 * otras dos: cubrió pocos waypoints (A) y casi ningún punto suyo cayó en el
 * corredor (B). Es el caso que hacía falta para probar que las compuertas no se
 * colapsan.
 */
function desvioLargo(imei: string, unitId: string): GpsPoint[] {
  const origen = [0, 1].map((i) => punto(imei, i, TRAZADO[i]!.lat, TRAZADO[i]!.lng, unitId));
  const lejos = Array.from({ length: 14 }, (_, k) =>
    punto(imei, 2 + k, 31.68 + k * 0.001, -106.47, unitId),
  );
  const regreso = [18, 19].map((i) =>
    punto(imei, i, TRAZADO[i]!.lat, TRAZADO[i]!.lng, unitId),
  );
  return [...origen, ...lejos, ...regreso];
}

function entrada(puntos: GpsPoint[], extra: Partial<VerificationInput> = {}): VerificationInput {
  return {
    occurrenceId: "occ-1",
    expectedDeadline: new Date(T0.getTime() + 19 * 60_000),
    toleranceMinutes: 10,
    routeStrictness: "kml_full",
    geofencePolygon: GEOCERCA,
    kmlWaypoints: TRAZADO,
    kmlMatchMinPct: 60,
    kmlCorridorMinPct: 60,
    kmlCorridorMeters: 120,
    kmlOriginToleranceFraction: 0.15,
    evidencePoints: puntos,
    ...extra,
  } as VerificationInput;
}

const VENTANA = { inicio: T0, fin: new Date(T0.getTime() + 19 * 60_000) };

function armar(v: ReturnType<typeof verifyService>, puntos: GpsPoint[]) {
  return armarCandidatasSnapshot({
    verification: v,
    evidencePoints: puntos,
    ventanaCobertura: VENTANA,
    trazadoEvaluado: { variantId: "var-1", kmlVersionId: "kml-1" },
  });
}

describe("el motivo por candidata", () => {
  it("una unidad que ni llegó sale con la compuerta `no_llego`", () => {
    const puntos = porOtroLado("111", "u-lejos");
    const v = verifyService(entrada(puntos));
    const snap = armar(v, puntos)!;

    // No llegó, así que no entra al corte de relevantes; se busca en el motor.
    const cand = v.candidateUnits.find((c) => c.unitId === "u-lejos")!;
    expect(cand.servedRoute).toBe(false);
    expect(cand.motivos?.map((m) => m.compuerta)).toContain("no_llego");
    expect(snap.evaluadas).toBe(1);
  });

  it("guarda TODAS las compuertas que fallaron, no solo la primera", () => {
    /*
     * Esta prueba nació mal y la corrección vale más que la prueba: el caso
     * original —solo el final del trazado— falla UNA sola compuerta, porque A se
     * calcula sobre el tramo observable y ese tramo lo cubre entero. La prueba
     * en rojo tenía razón; la premisa equivocada era mía.
     *
     * `desvioLargo` sí falla dos: se le ve el origen (tramo observable pasa) y
     * aun así cubre poco trazado y casi no pisa el corredor.
     */
    const puntos = desvioLargo("222", "u-desvio");
    const v = verifyService(entrada(puntos));
    const cand = v.candidateUnits.find((c) => c.unitId === "u-desvio")!;

    expect(cand.servedRoute).toBe(false);
    const compuertas = cand.motivos!.map((m) => m.compuerta);
    // La que importa: son DOS, no una. Colapsarlas inventaría una prioridad.
    expect(compuertas.length).toBe(2);
    expect(compuertas).toContain("cobertura_de_trazado");
    expect(compuertas).toContain("precision_de_corredor");
  });

  it("y cuando solo falla una, reporta una — no rellena de más", () => {
    // Solo se le ve el final: el tramo observable no alcanza, pero sobre ese
    // tramo cubrió todo y se mantuvo en corredor. Una compuerta, no tres.
    const puntos = soloLlegada("223", "u-tarde");
    const v = verifyService(entrada(puntos));
    const cand = v.candidateUnits.find((c) => c.unitId === "u-tarde")!;

    expect(cand.servedRoute).toBe(false);
    expect(cand.motivos!.map((m) => m.compuerta)).toEqual(["tramo_observable"]);
  });

  it("cada motivo dice a qué población se le preguntó — C25", () => {
    const puntos = soloLlegada("333", "u-x");
    const v = verifyService(entrada(puntos));
    const cand = v.candidateUnits.find((c) => c.unitId === "u-x")!;

    expect(cand.motivos!.length).toBeGreaterThan(0);
    for (const m of cand.motivos!) {
      // El match siempre se le pregunta a la candidata. Si algún día alguien
      // lo mide sobre el viaje, esta prueba tiene que gritarlo.
      expect(m.poblacion).toBe("candidata");
    }
  });

  it("cada motivo trae lo medido junto a su umbral, no uno sin el otro", () => {
    const puntos = soloLlegada("444", "u-y");
    const v = verifyService(entrada(puntos));
    const cand = v.candidateUnits.find((c) => c.unitId === "u-y")!;

    for (const m of cand.motivos!) {
      if (m.compuerta === "no_llego") continue;
      expect(m.medido).not.toBeNull();
      expect(m.umbral).not.toBeNull();
    }
  });

  it("una candidata que acredita sale SIN motivos — vacío significa que pasó", () => {
    const puntos = recorridoCompleto("555", "u-buena");
    const v = verifyService(entrada(puntos));
    const cand = v.candidateUnits.find((c) => c.unitId === "u-buena")!;

    expect(cand.servedRoute).toBe(true);
    expect(cand.motivos).toEqual([]);
  });

  it("el motivo nunca contradice al veredicto", () => {
    for (const puntos of [
      recorridoCompleto("1", "a"),
      soloLlegada("2", "b"),
      porOtroLado("3", "c"),
    ]) {
      const v = verifyService(entrada(puntos));
      for (const c of v.candidateUnits) {
        // Si acreditó, no puede traer motivos. Si no, tiene que traer al menos uno.
        expect(c.motivos!.length === 0).toBe(c.servedRoute);
      }
    }
  });
});

describe("el corte, y la ley que lo acompaña", () => {
  it("guarda cuántas se evaluaron EN TOTAL, no cuántas se guardaron", () => {
    const puntos = [
      ...recorridoCompleto("1", "a"),
      ...porOtroLado("2", "b"),
      ...porOtroLado("3", "c"),
    ];
    const v = verifyService(entrada(puntos));
    const snap = armar(v, puntos)!;

    expect(snap.evaluadas).toBe(3);
    // Y se guardaron menos: eso es el corte haciendo su trabajo.
    expect(snap.candidatas.length).toBeLessThan(snap.evaluadas);
  });

  it("declara con qué criterio recortó, para que el corte sea auditable", () => {
    const puntos = recorridoCompleto("1", "a");
    const snap = armar(verifyService(entrada(puntos)), puntos)!;
    expect([CRITERIO_RELEVANTE, CRITERIO_SOLO_LLEGADA]).toContain(snap.criterio);
  });

  it("nunca deja el expediente vacío: si nadie se acerca, cae a las que llegaron", () => {
    // Llega a la geocerca pero su corredor queda por debajo del piso.
    const puntos = soloLlegada("9", "u-rasante");
    const v = verifyService(entrada(puntos));
    const snap = armar(v, puntos)!;
    const llegaron = v.candidateUnits.filter((c) => c.arrivalAt !== null);

    if (llegaron.length > 0) {
      expect(snap.candidatas.length).toBeGreaterThan(0);
      const bajoPiso = llegaron.every(
        (c) => c.corridorPrecisionPct <= PISO_CORREDOR_RELEVANTE_PCT,
      );
      if (bajoPiso) expect(snap.criterio).toBe(CRITERIO_SOLO_LLEGADA);
    }
  });

  it("guarda contra qué trazado se calificó, aunque ninguna acredite", () => {
    const puntos = soloLlegada("8", "u-z");
    const v = verifyService(entrada(puntos));
    const snap = armar(v, puntos)!;

    expect(v.status).not.toBe("cumplido");
    // `servedVariantId` seguirá en nulo; esto es la OTRA pregunta.
    expect(snap.trazadoEvaluado).toEqual({ variantId: "var-1", kmlVersionId: "kml-1" });
  });
});

describe("null no es lista vacía", () => {
  it("sin ninguna candidata evaluada devuelve null, no un arreglo vacío", () => {
    const v = verifyService(entrada([]));
    expect(armar(v, [])).toBeNull();
  });

  it("con candidatas evaluadas nunca devuelve null", () => {
    const puntos = porOtroLado("7", "u-lejos");
    const snap = armar(verifyService(entrada(puntos)), puntos);
    expect(snap).not.toBeNull();
    expect(snap!.evaluadas).toBeGreaterThan(0);
  });
});

describe("la señal es de cada candidata, no la del viaje", () => {
  it("dos unidades con densidad distinta dan señales distintas", () => {
    const densa = recorridoCompleto("100", "u-densa");
    const rala = [0, 9, 19].map((i) =>
      punto("200", i, TRAZADO[i]!.lat, TRAZADO[i]!.lng, "u-rala"),
    );
    const puntos = [...densa, ...rala];
    const v = verifyService(entrada(puntos));
    const snap = armar(v, puntos)!;

    const porUnidad = new Map(snap.candidatas.map((c) => [c.unidadId, c.senal]));
    const sDensa = porUnidad.get("u-densa");
    const sRala = porUnidad.get("u-rala");

    if (sDensa && sRala) {
      expect(sDensa.puntos).toBeGreaterThan(sRala.puntos);
      // Si esto fallara, la señal se estaría tomando de la mejor unidad del
      // viaje y no de cada candidata — que es el defecto que la Parte 2 arregla.
      expect(sDensa.cadenciaMedianaS).not.toBe(sRala.cadenciaMedianaS);
    }
  });
});

describe("nada de esto mueve un veredicto", () => {
  it("el status y la unidad observada son los mismos con y sin snapshot", () => {
    for (const puntos of [
      recorridoCompleto("1", "a"),
      soloLlegada("2", "b"),
      porOtroLado("3", "c"),
      [],
    ]) {
      const antes = verifyService(entrada(puntos));
      const status = antes.status;
      const unidad = antes.observedUnitId;

      armar(antes, puntos); // armar el expediente no puede tocar nada

      expect(antes.status).toBe(status);
      expect(antes.observedUnitId).toBe(unidad);
    }
  });
});
