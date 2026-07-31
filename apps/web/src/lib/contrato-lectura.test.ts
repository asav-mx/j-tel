import { describe, it, expect } from "vitest";
import {
  distribucion,
  lecturaDeUmbral,
  margenEnMinutos,
  sospechaDeVentana,
  usosDeMotivos,
  resumirResultados,
  MINIMO_PARA_LEER,
  type HechoParaLectura,
} from "./contrato-lectura";

const DEADLINE = new Date("2026-07-22T12:45:00Z");

function hecho(over: Partial<HechoParaLectura> = {}): HechoParaLectura {
  return {
    estado: "cumplido",
    deadline: DEADLINE,
    llegada: new Date(DEADLINE.getTime() - 5 * 60_000),
    coberturaRutaPct: 94,
    motivoExcusable: null,
    ...over,
  };
}

/** Llegada a `minutos` de la hora límite. Negativo: antes. */
function llegadaA(minutos: number): Date {
  return new Date(DEADLINE.getTime() + minutos * 60_000);
}

describe("distribucion", () => {
  it("usa mediana, no promedio: un extremo no la tuerce", () => {
    // El promedio de esto es 28.6; la mediana, 10.
    const d = distribucion([9, 10, 10, 11, 103])!;
    expect(d.mediana).toBe(10);
    expect(d.minimo).toBe(9);
    expect(d.maximo).toBe(103);
    expect(d.n).toBe(5);
  });

  it("con número par de valores promedia los dos de en medio", () => {
    expect(distribucion([10, 20, 30, 40])!.mediana).toBe(25);
  });

  it("sin valores no hay distribución que enseñar", () => {
    expect(distribucion([])).toBeNull();
  });
});

describe("dónde vive la operación respecto al umbral", () => {
  it("holgura amplia: toda la operación está del lado bueno", () => {
    const l = lecturaDeUmbral([88, 92, 94, 96, 99], 60)!;
    expect(l.holgura).toBe("amplia");
    expect(l.margenMediana).toBe(34);
    expect(l.debajo).toBe(0);
  });

  it("holgura justa: el rango real toca el umbral", () => {
    // Mover el umbral dos puntos aquí cambia resultados de verdad.
    const l = lecturaDeUmbral([84.6, 90, 96.4, 98.2], 85)!;
    expect(l.holgura).toBe("justa");
    expect(l.debajo).toBe(1);
    expect(l.alFilo).toBe(1);
  });

  it("holgura invertida: la mediana cayó del lado malo", () => {
    // El umbral no describe esta operación — quien lo puso se equivocó.
    const l = lecturaDeUmbral([40, 45, 50, 55], 80)!;
    expect(l.holgura).toBe("invertida");
    expect(l.margenMediana).toBe(-32.5);
    expect(l.debajo).toBe(4);
  });

  it("sin hechos no inventa una lectura", () => {
    expect(lecturaDeUmbral([], 60)).toBeNull();
  });
});

describe("margen de llegada", () => {
  it("es negativo cuando llegó antes de la hora límite", () => {
    expect(margenEnMinutos(hecho({ llegada: llegadaA(-10) }))).toBe(-10);
  });

  it("es positivo cuando llegó tarde", () => {
    expect(margenEnMinutos(hecho({ llegada: llegadaA(7) }))).toBe(7);
  });

  it("es nulo cuando el árbitro nunca observó una llegada", () => {
    expect(margenEnMinutos(hecho({ llegada: null }))).toBeNull();
  });
});

describe("la ventana está mirando donde ocurre la operación", () => {
  const ventana = { abreMinAntes: 60, cierraMinDespues: 45 };

  it("una operación normal no levanta sospecha", () => {
    const hechos = Array.from({ length: 20 }, (_, i) =>
      hecho({ llegada: llegadaA(-12 + (i % 5)) }),
    );
    expect(sospechaDeVentana(hechos, ventana).hay).toBe(false);
  });

  it("el turno declarado a una hora que no se opera: las llegadas caen lejísimos", () => {
    // El caso real: turno declarado 18:00, operado 14:00. Las pocas llegadas
    // que alcanzan a verse caen ~4 h antes de la hora límite.
    const hechos = Array.from({ length: 20 }, () => hecho({ llegada: llegadaA(-240) }));
    const s = sospechaDeVentana(hechos, ventana);

    expect(s.hay).toBe(true);
    if (!s.hay) throw new Error("inalcanzable");
    expect(s.clase).toBe("llegadas_lejos");
    expect(s.medidos.medianaMargenMin).toBe(-240);
    // La sospecha trae sus números: sin ellos sería una corazonada.
    expect(s.medidos.ventanaAbreMin).toBe(60);
    expect(s.medidos.total).toBe(20);
  });

  it("y su otra huella: casi ningún servicio llegó a tener llegada observada", () => {
    const hechos = [
      ...Array.from({ length: 16 }, () =>
        hecho({ estado: "no_cumplido", llegada: null }),
      ),
      ...Array.from({ length: 4 }, () => hecho({ llegada: llegadaA(-8) })),
    ];
    const s = sospechaDeVentana(hechos, ventana);

    expect(s.hay).toBe(true);
    if (!s.hay) throw new Error("inalcanzable");
    expect(s.clase).toBe("sin_llegadas");
    expect(s.medidos.sinLlegada).toBe(16);
    expect(s.medidos.conLlegada).toBe(4);
  });

  it("llegar tarde por sistema no es sospecha de ventana: cae dentro del cierre", () => {
    // 30 min tarde es un problema de puntualidad, no de configuración. La
    // pantalla no debe confundir un carrier impuntual con una hora mal puesta.
    const hechos = Array.from({ length: 20 }, () => hecho({ llegada: llegadaA(30) }));
    expect(sospechaDeVentana(hechos, ventana).hay).toBe(false);
  });

  it("con pocos hechos se calla en vez de alarmar por ruido", () => {
    const hechos = Array.from({ length: MINIMO_PARA_LEER - 1 }, () =>
      hecho({ llegada: llegadaA(-240) }),
    );
    expect(sospechaDeVentana(hechos, ventana).hay).toBe(false);
  });
});

describe("uso de motivos excusables", () => {
  it("cuenta los usos y muestra también los que nadie invocó", () => {
    const hechos = [
      hecho({ motivoExcusable: "obra_sin_aviso" }),
      hecho({ motivoExcusable: "obra_sin_aviso" }),
      hecho({ motivoExcusable: "obstruccion" }),
      hecho(),
    ];
    const usos = usosDeMotivos(hechos, ["obra_sin_aviso", "obstruccion", "ponchadura"]);

    expect(usos).toEqual([
      { motivo: "obra_sin_aviso", usos: 2 },
      { motivo: "obstruccion", usos: 1 },
      // Un motivo habilitado que nadie usó es información: se muestra en cero.
      { motivo: "ponchadura", usos: 0 },
    ]);
  });

  it("un motivo invocado que ya no está habilitado igual aparece", () => {
    // Si se deshabilitó después, los hechos viejos siguen citándolo.
    const usos = usosDeMotivos([hecho({ motivoExcusable: "marchas" })], []);
    expect(usos).toEqual([{ motivo: "marchas", usos: 1 }]);
  });
});

describe("resumirResultados", () => {
  it("cuenta los tres resultados y nada más", () => {
    const r = resumirResultados([
      hecho(),
      hecho(),
      hecho({ estado: "no_cumplido" }),
      hecho({ estado: "pendiente_evidencia" }),
    ]);
    expect(r).toEqual({
      total: 4,
      cumplido: 2,
      no_cumplido: 1,
      pendiente_evidencia: 1,
    });
  });
});
