import { describe, expect, it } from "vitest";
import {
  contarTurno,
  esExcepcion,
  formatearDuracion,
  limiteConTolerancia,
  margenMinutos,
  mayorHueco,
  titularDelTurno,
} from "./cierre.js";

const en = (iso: string) => new Date(iso);
const ventana = { inicio: en("2026-07-24T11:45:00Z"), fin: en("2026-07-24T13:30:00Z") };

describe("mayorHueco", () => {
  it("encuentra el hueco entre dos puntos y devuelve sus bordes", () => {
    const h = mayorHueco(
      [
        { at: en("2026-07-24T11:50:00Z") },
        { at: en("2026-07-24T12:12:00Z") },
        { at: en("2026-07-24T12:58:00Z") },
        { at: en("2026-07-24T13:02:00Z") },
      ],
      ventana,
    );
    expect(h?.minutos).toBe(46);
    expect(h?.desde.toISOString()).toBe("2026-07-24T12:12:00.000Z");
    expect(h?.hasta.toISOString()).toBe("2026-07-24T12:58:00.000Z");
  });

  it("cuenta el silencio inicial: un GPS que empieza tarde deja hueco desde el borde", () => {
    const h = mayorHueco(
      [{ at: en("2026-07-24T13:20:00Z") }, { at: en("2026-07-24T13:25:00Z") }],
      ventana,
    );
    expect(h?.minutos).toBe(95);
    expect(h?.desde.toISOString()).toBe(ventana.inicio.toISOString());
  });

  it("cuenta el silencio final", () => {
    const h = mayorHueco(
      [{ at: en("2026-07-24T11:46:00Z") }, { at: en("2026-07-24T11:50:00Z") }],
      ventana,
    );
    expect(h?.minutos).toBe(100);
    expect(h?.hasta.toISOString()).toBe(ventana.fin.toISOString());
  });

  it("sin puntos, el hueco es la ventana entera — que es justo lo que hay que decir", () => {
    expect(mayorHueco([], ventana)?.minutos).toBe(105);
  });

  it("ignora puntos fuera de la ventana en vez de estirar el hueco", () => {
    const h = mayorHueco(
      [
        { at: en("2026-07-24T09:00:00Z") },
        { at: en("2026-07-24T11:46:00Z") },
        { at: en("2026-07-24T13:29:00Z") },
        { at: en("2026-07-24T18:00:00Z") },
      ],
      ventana,
    );
    expect(h?.minutos).toBe(103);
  });

  it("una ventana invertida o vacía no produce hueco inventado", () => {
    expect(mayorHueco([], { inicio: ventana.fin, fin: ventana.inicio })).toBeNull();
  });
});

describe("formatearDuracion", () => {
  it("nunca usa formato de hora, que se leería como hora del día", () => {
    expect(formatearDuracion(10)).toBe("10 min");
    expect(formatearDuracion(10)).not.toBe("10:00");
  });

  it("escribe horas cuando pasa de sesenta", () => {
    expect(formatearDuracion(134)).toBe("2 h 14 min");
    expect(formatearDuracion(120)).toBe("2 h");
  });

  it("conserva los segundos, que es donde vive la exactitud", () => {
    expect(formatearDuracion(2 + 14 / 60)).toBe("2:14 min");
    expect(formatearDuracion(0.5)).toBe("30 s");
  });

  it("el signo lo pone quien lo escribe, no la duración", () => {
    expect(formatearDuracion(-3.5)).toBe("3:30 min");
  });
});

describe("margen y límite", () => {
  it("el límite es el deadline más la tolerancia congelada", () => {
    expect(
      limiteConTolerancia(en("2026-07-24T12:45:00Z"), 5).toISOString(),
    ).toBe("2026-07-24T12:50:00.000Z");
  });

  it("negativo llegó antes, positivo llegó después", () => {
    const limite = en("2026-07-24T12:50:00Z");
    expect(margenMinutos(en("2026-07-24T12:46:32Z"), limite)).toBeCloseTo(-3.467, 3);
    expect(margenMinutos(en("2026-07-24T12:52:14Z"), limite)).toBeCloseTo(2.233, 3);
  });
});

describe("esExcepcion", () => {
  it("un cumplido dentro de tolerancia no molesta a nadie", () => {
    expect(esExcepcion("cumplido", "a_tiempo")).toBe(false);
    expect(esExcepcion("cumplido", "temprano")).toBe(false);
  });

  it("un cumplido tarde sigue siendo cumplido, pero sube a excepciones", () => {
    expect(esExcepcion("cumplido", "tarde")).toBe(true);
  });

  it("no cumplido y pendiente siempre necesitan al usuario", () => {
    expect(esExcepcion("no_cumplido", null)).toBe(true);
    expect(esExcepcion("pendiente_evidencia", null)).toBe(true);
  });

  it("sin hecho no es excepción: el turno no ha cerrado para ese servicio", () => {
    expect(esExcepcion(null, null)).toBe(false);
  });
});

describe("contarTurno y titular", () => {
  const turno = [
    { estado: "cumplido" as const, timing: "a_tiempo" },
    { estado: "cumplido" as const, timing: "temprano" },
    { estado: "cumplido" as const, timing: "tarde" },
    { estado: "no_cumplido" as const, timing: null },
    { estado: "pendiente_evidencia" as const, timing: null },
  ];

  it("cuenta veredictos y desglosa el cumplido", () => {
    const c = contarTurno(turno);
    expect(c).toMatchObject({
      total: 5,
      cumplido: 3,
      no_cumplido: 1,
      pendiente_evidencia: 1,
      tarde: 1,
      temprano: 1,
      a_tiempo: 1,
    });
  });

  it("el titular se sostiene con el conteo, sin depender del ledger", () => {
    expect(titularDelTurno(contarTurno(turno))).toBe("El turno cerró. 3 servicios te necesitan.");
  });

  it("distingue singular, limpio, vacío y todavía abierto", () => {
    expect(titularDelTurno(contarTurno([{ estado: "no_cumplido", timing: null }]))).toBe(
      "El turno cerró. Un servicio te necesita.",
    );
    expect(titularDelTurno(contarTurno([{ estado: "cumplido", timing: "a_tiempo" }]))).toBe(
      "El turno cerró limpio.",
    );
    expect(titularDelTurno(contarTurno([]))).toBe("No hay servicios programados para este turno.");
    expect(titularDelTurno(contarTurno([{ estado: null, timing: null }]))).toBe(
      "El turno todavía no cierra.",
    );
  });
});
