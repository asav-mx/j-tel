/**
 * El aviso de la ventana desalineada — Frente A.
 *
 * Lo que vigilan, y el orden es el de lo que cuesta si falla:
 *
 *   1. Que **no insinúe que un veredicto cambiaría**. No lo sabe: otra ventana
 *      es otra evidencia, y saberlo exige correr el árbitro (D4). Un aviso que
 *      lo insinúe convierte una alerta en una promesa.
 *   2. Que **separe las dos causas** —la historia creciendo contra alguien
 *      moviendo una perilla—. Tienen dueños distintos, y mezclarlas manda a
 *      revisar la perilla equivocada.
 *   3. Que el signo del corrimiento **case con su lectura**. Su hermano ya
 *      escribió «tarde» junto a «va antes» en la misma línea, y no lo atrapó
 *      ninguna prueba: lo atrapó leer el correo.
 *   4. Que el asunto nombre la VENTANA y no la hora límite.
 */
import { describe, it, expect } from "vitest";
import { avisoVentanaDesalineada, asuntoDe } from "./decision";

const AHORA = new Date("2026-08-14T12:00:00Z");

const GRUPO = {
  contratoNombre: "Contrato de ejemplo",
  rutaNombre: "Ruta de ejemplo",
  turnoNombre: "Turno A",
  ocurrencias: 21,
  congeladaMinutos: 60,
  derivadaMinutos: 93,
  difMinutos: 33,
  baseHoy: "medida" as const,
  muestras: 12,
  proxima: "2026-08-15",
};

describe("no promete lo que no sabe", () => {
  it("NO dice que algún veredicto cambiaría", () => {
    const a = avisoVentanaDesalineada(GRUPO, AHORA, 1013);
    const todo = [a.titulo, a.consecuencia, a.accion, ...a.detalle].join(" ").toLowerCase();

    expect(todo).not.toContain("cambiaría el resultado");
    expect(todo).not.toContain("se acreditaría");
    // Y lo dice explícitamente, que es más fuerte que solo callarlo.
    expect(todo).toContain("no dice si algún veredicto cambiaría");
  });

  it("la acción es decidir, no corregir — el cron no corrige", () => {
    const a = avisoVentanaDesalineada(GRUPO, AHORA, 1013);
    expect(a.accion.toLowerCase()).toContain("decidir");
    expect(a.accion).toContain("Asav");
  });
});

describe("separa las dos causas", () => {
  it("cuando la ventana se movió por la historia medida, lo dice y trae las muestras", () => {
    const a = avisoVentanaDesalineada(GRUPO, AHORA, 1013);
    const causa = a.mediciones.find((m) => m.etiqueta === "Por qué cambió")!;
    expect(causa.valor).toBe("medida");
    expect(causa.lectura).toContain("duración medida");
    expect(causa.lectura).toContain("12 muestras");
  });

  it("cuando la movió la política, NO la atribuye a la medición", () => {
    const a = avisoVentanaDesalineada({ ...GRUPO, baseHoy: "politica" }, AHORA, 1013);
    const causa = a.mediciones.find((m) => m.etiqueta === "Por qué cambió")!;
    expect(causa.lectura).toContain("política del contrato");
    expect(causa.lectura).not.toContain("duración medida");
  });

  it("sin historia suficiente dice que hoy se estimaría sobre la geometría", () => {
    const a = avisoVentanaDesalineada({ ...GRUPO, baseHoy: "estimada_geometria" }, AHORA, 1013);
    expect(
      a.mediciones.find((m) => m.etiqueta === "Por qué cambió")!.lectura,
    ).toContain("geometría");
  });
});

describe("el signo casa con su lectura", () => {
  it("si hoy abriría antes, dice que la congelada mira MENOS", () => {
    const a = avisoVentanaDesalineada(GRUPO, AHORA, 1013);
    const m = a.mediciones.find((x) => x.etiqueta === "La ventana congelada abre")!;
    expect(m.valor).toContain("60");
    expect(m.lectura).toContain("93");
    expect(m.lectura).toContain("MENOS");
    expect(a.consecuencia).toContain("menos recorrido");
  });

  it("si hoy abriría después, NO dice que mira menos", () => {
    const a = avisoVentanaDesalineada(
      { ...GRUPO, congeladaMinutos: 120, derivadaMinutos: 90, difMinutos: -30 },
      AHORA,
      1013,
    );
    const m = a.mediciones.find((x) => x.etiqueta === "La ventana congelada abre")!;
    expect(m.lectura).not.toContain("MENOS");
    expect(a.consecuencia).not.toContain("menos recorrido");
  });
});

describe("el asunto nombra el campo correcto", () => {
  it("dice ventana, no hora límite — son dos campos con dos arreglos", () => {
    const asunto = asuntoDe(avisoVentanaDesalineada(GRUPO, AHORA, 1013));
    expect(asunto).toContain("Ventana");
    expect(asunto).not.toContain("Hora límite");
  });
});

describe("el conteo se lee con su universo", () => {
  it("dice cuántos de cuántos revisados", () => {
    const a = avisoVentanaDesalineada(GRUPO, AHORA, 1013);
    const m = a.mediciones.find((x) => x.etiqueta === "Servicios sin sellar")!;
    expect(m.valor).toBe("21");
    // Sin el denominador, «21 servicios» no dice si es mucho o poco.
    expect(m.lectura).toContain("1013");
  });
});
