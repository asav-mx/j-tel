import { describe, expect, it } from "vitest";
import {
  datoDePapel,
  datoDeResumen,
  edad,
  fechaCorta,
  glifoDeDispositivo,
  glifoDePapel,
  glifoDeUnidad,
  papelApagado,
  rutas,
  titularDePapel,
  umbralDePapel,
} from "./expedientes";

const AHORA = new Date("2026-09-16T18:00:00Z");

describe("cada estado de papel tiene su forma, y ninguna se repite", () => {
  it("siete formas para siete estados con pieza; «no capturado» no lleva", () => {
    const estados = ["vencido", "por_vencer", "falta", "falta_la_fecha", "falta_la_regla", "vigente", "sin_vencimiento"] as const;
    const formas = estados.map(glifoDePapel);
    expect(new Set(formas).size).toBe(7);
    expect(glifoDePapel("no_capturado")).toBeNull();
  });

  it("sólo lo que está al día se apaga", () => {
    expect(papelApagado("vigente")).toBe(true);
    expect(papelApagado("sin_vencimiento")).toBe(true);
    expect(papelApagado("falta_la_regla")).toBe(false);
    expect(papelApagado("por_vencer")).toBe(false);
  });
});

describe("el número del vistazo y el del umbral", () => {
  it("vencido y por vencer", () => {
    expect(datoDePapel({ estado: "vencido", venceEl: "2026-09-13", diasVencido: 3 })).toEqual({ dato: "hace 3 d", etiqueta: "venció" });
    expect(datoDePapel({ estado: "por_vencer", venceEl: "2026-09-28", diasRestantes: 12 })).toEqual({ dato: "en 12 d", etiqueta: "vence" });
    expect(datoDePapel({ estado: "por_vencer", venceEl: "2026-09-16", diasRestantes: 0 }).dato).toBe("hoy");
  });

  it("sin regla muestra sus días, pero no los llama vigentes ni por vencer", () => {
    const e = { estado: "falta_la_regla", falta: "dias_de_aviso", venceEl: "2026-09-28", diasRestantes: 12 } as const;
    expect(datoDePapel(e)).toEqual({ dato: "en 12 d", etiqueta: "sin regla" });
    expect(umbralDePapel(e, null)).toBe("vence el 28 sep 2026 · el catálogo todavía no dice sus días de aviso");
  });

  it("en la decisión, la fecha con los días de aviso de su tipo", () => {
    expect(umbralDePapel({ estado: "vigente", venceEl: "2027-04-18", diasRestantes: 214 }, 30)).toBe(
      "vence el 18 abr 2027 · aviso de su tipo: 30 d",
    );
    expect(titularDePapel({ estado: "vencido", venceEl: "2026-09-13", diasVencido: 3 })).toBe("Venció hace 3 días");
    expect(titularDePapel({ estado: "vencido", venceEl: "2026-09-15", diasVencido: 1 })).toBe("Venció ayer");
  });

  it("el resumen de una unidad: lo que pide algo manda; sin regla no es «al día»", () => {
    expect(datoDeResumen({ pidenAlgo: 2, faltaLaRegla: 1, peor: "vencido", estaAlDia: false })).toEqual({ dato: "2", etiqueta: "piden algo" });
    expect(datoDeResumen({ pidenAlgo: 0, faltaLaRegla: 3, peor: "falta_la_regla", estaAlDia: false })).toEqual({ dato: "—", etiqueta: "sin regla" });
    expect(datoDeResumen({ pidenAlgo: 0, faltaLaRegla: 0, peor: "vigente", estaAlDia: true })).toEqual({ dato: "0", etiqueta: "al día" });
  });
});

describe("unidades y dispositivos, cada uno en su familia", () => {
  it("sin señal es círculo hueco; desconectada es flecha hueca", () => {
    expect(glifoDeUnidad({ tipo: "sin_senal", dispositivoId: "d", ultimaSenalAt: null }).glifo).toBe("sin-senal");
    expect(glifoDeUnidad({ tipo: "desconectado", dispositivoId: "d", ultimaSenalAt: null }).glifo).toBe("sin-transmitir");
  });

  it("sin dispositivo es la flecha punteada, no la de desconectada (decisión 7); en destino es el anillo punteado", () => {
    expect(glifoDeUnidad({ tipo: "sin_dispositivo" }).glifo).toBe("sin-dispositivo");
    const destino = { lugarId: "p", lugarNombre: "Planta 47", llegadaAt: AHORA, entradaObservada: true };
    expect(glifoDeUnidad({ tipo: "en_destino", dispositivoId: "d", destino, ultimaSenalAt: AHORA }).glifo).toBe("en-destino");
  });

  it("en línea sin velocidad no afirma rumbo", () => {
    const g = glifoDeUnidad({ tipo: "en_linea", dispositivoId: "d", postura: "sin_velocidad", ultimaSenalAt: AHORA, velocidadKmh: null, rumbo: null });
    expect(g.glifo).toBe("detenida");
    expect(g.rumbo).toBeUndefined();
  });

  it("los dispositivos son cuadros", () => {
    expect(glifoDeDispositivo({ grupo: "en_bodega", ultimaSenalAt: null }).glifo).toBe("dispositivo-en-bodega");
  });
});

describe("tiempo escrito para leerse", () => {
  it("la edad de un dato vivo", () => {
    expect(edad(new Date(AHORA.getTime() - 14_000), AHORA)).toBe("hace 14 s");
    expect(edad(new Date(AHORA.getTime() - 2 * 60_000), AHORA)).toBe("hace 2 min");
    expect(edad(new Date(AHORA.getTime() - 3.8 * 3_600_000), AHORA)).toBe("hace 3.8 h");
    expect(edad(new Date(AHORA.getTime() - 3 * 86_400_000), AHORA)).toBe("hace 3 d");
  });

  it("una fecha civil sin comas", () => {
    expect(fechaCorta("2026-09-13")).toBe("13 sep 2026");
  });

  it("las rutas llevan la cuenta sólo cuando se dice", () => {
    expect(rutas.unidad("u1")).toBe("/casa/transportista/expedientes/unidad/u1");
    expect(rutas.papel("u1", "t1", "juarez-bus", "corregir")).toBe(
      "/casa/transportista/expedientes/unidad/u1/papel/t1?accion=corregir&account=juarez-bus",
    );
  });
});
