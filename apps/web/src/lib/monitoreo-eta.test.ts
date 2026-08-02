import { describe, it, expect } from "vitest";
import { SIN_SENAL_MINUTOS } from "@jtel/domain";
import { SIN_SENAL_MINUTOS as UMBRAL_DE_LA_BANDA } from "./monitoreo-umbrales";
import {
  estimarLlegada,
  AVANCE_MINIMO_PARA_RITMO,
  PERCENTIL_ETA,
  type EntradaEta,
} from "./monitoreo-eta";

/**
 * La llegada estimada es inferencia, y estas pruebas cuidan que no se disfrace
 * de medición: que no aparezca sobre datos viejos, que no se calcule sobre lo
 * que ya ocurrió, y que siempre diga de dónde salió.
 */

/** Un viaje a medio camino, con señal fresca y sin historia. Se ajusta por caso. */
function entrada(over: Partial<EntradaEta> = {}): EntradaEta {
  return {
    cerrado: false,
    llego: false,
    edadSenalMinutos: 2,
    avanceFraccion: 0.5,
    restanteKm: 10,
    transcurridoMinutos: 30,
    muestras: [],
    avgSpeedKmh: 20,
    ...over,
  };
}

describe("el umbral de señal vieja es UNO solo", () => {
  /**
   * Si estos dos números se separan, la torre se contradice: la unidad se ve en
   * ámbar "sin señal" y a la vez muestra una hora de llegada, o al revés. La
   * prueba existe para que separarlos truene aquí y no en la pantalla.
   */
  it("la banda y la estimación leen el mismo valor del dominio", () => {
    expect(UMBRAL_DE_LA_BANDA).toBe(SIN_SENAL_MINUTOS);
  });
});

describe("las negativas van antes de cualquier cuenta", () => {
  it("señal vieja no produce hora, aunque la cascada pudiera responder", () => {
    // Con historia de sobra: si el corte no estuviera, esto daría base "medida".
    const conTodo = entrada({
      edadSenalMinutos: SIN_SENAL_MINUTOS,
      muestras: [
        { durationMinutes: 60 },
        { durationMinutes: 60 },
        { durationMinutes: 60 },
      ],
    });
    expect(estimarLlegada(conTodo)).toBeNull();

    // Y un minuto antes del umbral sí responde: el corte es el umbral, no otro.
    expect(
      estimarLlegada({ ...conTodo, edadSenalMinutos: SIN_SENAL_MINUTOS - 1 }),
    ).not.toBeNull();
  });

  it("sin unidad de la cual preguntar la señal, no hay estimación", () => {
    expect(estimarLlegada(entrada({ edadSenalMinutos: null }))).toBeNull();
  });

  it("lo que ya ocurrió no se estima", () => {
    expect(estimarLlegada(entrada({ llego: true }))).toBeNull();
    expect(estimarLlegada(entrada({ cerrado: true }))).toBeNull();
  });
});

describe("la cascada, en orden", () => {
  const tresRecorridos = [
    { durationMinutes: 40 },
    { durationMinutes: 50 },
    { durationMinutes: 90 },
  ];

  it("la historia medida gana cuando alcanza, y usa la mediana", () => {
    // Ordenadas: 40, 50, 90. p50 con rango más cercano → ceil(0.5*3)=2 → 50 min.
    // A mitad de ruta falta la mitad de esa duración típica: 25 min.
    const r = estimarLlegada(
      entrada({ muestras: tresRecorridos, avanceFraccion: 0.5 }),
    );
    expect(r).toEqual({ minutosRestantes: 25, base: "medida" });
  });

  it("el percentil de la ETA es el de acertar, no el de cubrirse", () => {
    // Si usara p90 tomaría 90 min y diría 45. La ventana usa p90 a propósito;
    // la estimación no. Este número es el que separa las dos preguntas.
    expect(PERCENTIL_ETA).toBe(50);
    const r = estimarLlegada(
      entrada({ muestras: tresRecorridos, avanceFraccion: 0.5 }),
    );
    expect(r?.minutosRestantes).not.toBe(45);
  });

  it("con una o dos muestras la historia no responde — el caso real de hoy", () => {
    // `route_traversal_measurements` tiene hoy UNA muestra por ruta. La base
    // `medida` no debe aparecer con eso.
    for (const pocas of [
      [{ durationMinutes: 60 }],
      [{ durationMinutes: 60 }, { durationMinutes: 60 }],
    ]) {
      const r = estimarLlegada(entrada({ muestras: pocas }));
      expect(r?.base).not.toBe("medida");
    }
  });

  it("sin historia, el ritmo de este viaje", () => {
    // 30 min para cubrir la mitad → 60 min de ruta completa → faltan 30.
    const r = estimarLlegada(
      entrada({ avanceFraccion: 0.5, transcurridoMinutos: 30 }),
    );
    expect(r).toEqual({ minutosRestantes: 30, base: "ritmo_observado" });
  });

  it("sin historia ni avance suficiente, la geometría del trazado", () => {
    // 10 km restantes a 20 km/h → 30 min.
    const r = estimarLlegada(entrada({ avanceFraccion: 0.05, restanteKm: 10 }));
    expect(r).toEqual({ minutosRestantes: 30, base: "estimada_geometria" });
  });

  it("sin ninguna de las tres, no se inventa un número", () => {
    expect(
      estimarLlegada(
        entrada({ avanceFraccion: 0.05, restanteKm: null, transcurridoMinutos: null }),
      ),
    ).toBeNull();
  });
});

describe("el guardarraíl del ritmo observado", () => {
  /**
   * El caso que lo justifica: la unidad lleva 20 minutos levantando gente en el
   * origen y va en el 3 % de la ruta. Los dos datos son correctos y la
   * extrapolación —647 minutos de camino— es falsa.
   */
  it("al 3 % de avance no responde, y cede a la geometría", () => {
    const r = estimarLlegada(
      entrada({ avanceFraccion: 0.03, transcurridoMinutos: 20, restanteKm: 10 }),
    );
    expect(r?.base).toBe("estimada_geometria");
    expect(r?.minutosRestantes).toBe(30);
  });

  it("pasado el umbral sí responde", () => {
    const justoDebajo = estimarLlegada(
      entrada({ avanceFraccion: AVANCE_MINIMO_PARA_RITMO - 0.01 }),
    );
    const justoEncima = estimarLlegada(
      entrada({ avanceFraccion: AVANCE_MINIMO_PARA_RITMO }),
    );
    expect(justoDebajo?.base).toBe("estimada_geometria");
    expect(justoEncima?.base).toBe("ritmo_observado");
  });
});

describe("los bordes no producen números absurdos", () => {
  it("ruta ya completa: no hay camino que estimar, y no se dice 0 min", () => {
    expect(estimarLlegada(entrada({ avanceFraccion: 1 }))).toBeNull();
    // Fuera de rango por arriba se acota igual, no da negativo.
    expect(estimarLlegada(entrada({ avanceFraccion: 1.4 }))).toBeNull();
  });

  it("sin fracción de avance no hay desde dónde medir", () => {
    expect(estimarLlegada(entrada({ avanceFraccion: null }))).toBeNull();
    expect(estimarLlegada(entrada({ avanceFraccion: Number.NaN }))).toBeNull();
  });

  it("velocidad cero no divide entre cero: la geometría no responde", () => {
    const r = estimarLlegada(
      entrada({ avanceFraccion: 0.05, avgSpeedKmh: 0, transcurridoMinutos: null }),
    );
    expect(r).toBeNull();
  });

  it("duraciones no positivas no cuentan como historia", () => {
    const r = estimarLlegada(
      entrada({
        muestras: [
          { durationMinutes: 0 },
          { durationMinutes: -5 },
          { durationMinutes: 0 },
        ],
      }),
    );
    expect(r?.base).not.toBe("medida");
  });

  it("un avance negativo se acota a cero y no invierte la cuenta", () => {
    const r = estimarLlegada(
      entrada({ avanceFraccion: -0.3, restanteKm: 10, transcurridoMinutos: null }),
    );
    expect(r).toEqual({ minutosRestantes: 30, base: "estimada_geometria" });
  });
});
