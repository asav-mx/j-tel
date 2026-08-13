/**
 * El aviso de las ventanas desalineadas — Frente A.
 *
 * Lo que vigilan, y el orden es el de lo que cuesta si falla:
 *
 *   1. Que **no insinúe que un veredicto cambiaría**. No lo sabe: otra ventana
 *      es otra evidencia, y saberlo exige correr el árbitro (D4). Un aviso que
 *      lo insinúe convierte una alerta en una promesa.
 *   2. Que **separe las dos causas** —la historia creciendo contra alguien
 *      moviendo una perilla— y **las dos direcciones** —ensanchar contra
 *      angostar—, sin sumar ninguna de las dos parejas. Mezclarlas manda a
 *      revisar la perilla equivocada, o esconde que unas ventanas se mueven en
 *      el sentido contrario al que motivó la corrección.
 *   3. Que la congelada de un grupo se diga como **rango**. Dentro de un
 *      ruta×turno conviven ventanas de 60 y de 120 minutos: escribir la del
 *      primer servicio como si fuera la del grupo fue un dato correcto vuelto
 *      afirmación falsa por la agrupación, y pasó por 38 de 47 grupos.
 *   4. Que sea **un solo aviso**: 47 hallazgos en un correo se archivan igual
 *      que 47 correos.
 *   5. Que el asunto nombre la VENTANA y no la hora límite.
 */
import { describe, it, expect } from "vitest";
import { avisoVentanasDesalineadas, asuntoDe, type GrupoParaAviso } from "./decision";
import { renderAvisos, PIE_HORAS_LIMITE } from "./correo";

const AHORA = new Date("2026-08-14T12:00:00Z");

const GRUPO: GrupoParaAviso = {
  contratoNombre: "Contrato de ejemplo",
  rutaNombre: "Ruta de ejemplo",
  turnoNombre: "Turno A",
  ocurrencias: 21,
  congeladaMin: 60,
  congeladaMax: 60,
  derivadaMinutos: 93,
  ensanchan: 21,
  angostan: 0,
  baseHoy: "medida",
  muestras: 12,
  proxima: "2026-08-15",
};

const OTRO: GrupoParaAviso = {
  ...GRUPO,
  rutaNombre: "Otra ruta",
  turnoNombre: "Turno B",
  ocurrencias: 4,
  congeladaMin: 120,
  congeladaMax: 120,
  derivadaMinutos: 75,
  ensanchan: 0,
  angostan: 4,
  proxima: "2026-08-20",
};

const texto = (a: ReturnType<typeof avisoVentanasDesalineadas>) =>
  [a.titulo, a.consecuencia, a.accion, ...(a.detalle ?? [])].join(" ").toLowerCase();

describe("no promete lo que no sabe", () => {
  it("NO dice que algún veredicto cambiaría", () => {
    const todo = texto(avisoVentanasDesalineadas([GRUPO], AHORA, 1013));
    expect(todo).not.toContain("cambiaría el resultado");
    expect(todo).not.toContain("se acreditaría");
    // Y lo dice explícitamente, que es más fuerte que solo callarlo.
    expect(todo).toContain("no dice si algún veredicto cambiaría");
  });

  it("la acción es decidir, no corregir — el cron no corrige", () => {
    const a = avisoVentanasDesalineadas([GRUPO], AHORA, 1013);
    expect(a.accion.toLowerCase()).toContain("decidir");
    expect(a.accion).toContain("Asav");
  });
});

describe("es UN aviso, no uno por grupo", () => {
  it("cuarenta y siete grupos caben en un solo aviso con cuarenta y siete filas", () => {
    const muchos = Array.from({ length: 47 }, (_, i) => ({
      ...GRUPO,
      rutaNombre: `Ruta ${i}`,
    }));
    const a = avisoVentanasDesalineadas(muchos, AHORA, 1013);
    expect(a.tabla!.filas).toHaveLength(47);
    // Sin cortes: un desglose truncado se lee como si estuvieran todos.
    expect([...texto(a), ...a.tabla!.filas.flat()].join(" ")).not.toMatch(/\d+\s+más/);
    expect(a.mediciones.find((m) => m.etiqueta === "Rutas y turnos")!.valor).toBe("47");
  });

  it("el total de servicios suma los de todos los grupos, no cuenta grupos", () => {
    const a = avisoVentanasDesalineadas([GRUPO, OTRO], AHORA, 1013);
    expect(a.mediciones.find((m) => m.etiqueta === "Servicios sin sellar")!.valor).toBe("25");
  });
});

describe("separa las dos direcciones y NO las suma", () => {
  it("dice cuántas se ensanchan y cuántas se angostan, por separado", () => {
    const a = avisoVentanasDesalineadas([GRUPO, OTRO], AHORA, 1013);
    const m = a.mediciones.find((x) => x.etiqueta === "Hacia dónde se moverían")!;
    expect(m.valor).toContain("21");
    expect(m.lectura).toContain("4 se angostan");
    // Las 25 no pueden aparecer como si todas fueran en la misma dirección.
    expect(m.valor).not.toContain("25");
  });

  it("dice qué significa cada dirección, porque el signo solo no se lee", () => {
    const m = avisoVentanasDesalineadas([GRUPO], AHORA, 1013).mediciones.find(
      (x) => x.etiqueta === "Hacia dónde se moverían",
    )!;
    expect(m.lectura).toContain("mire más");
    expect(m.lectura).toContain("mire menos");
  });
});

describe("separa las dos causas", () => {
  it("cuenta la historia medida y la política por separado, sin un total", () => {
    const a = avisoVentanasDesalineadas(
      [GRUPO, { ...OTRO, baseHoy: "politica" }],
      AHORA,
      1013,
    );
    const causa = a.mediciones.find((m) => m.etiqueta === "Por qué cambió")!;
    expect(causa.valor).toContain("21 la duración medida");
    expect(causa.valor).toContain("4 cambió la política");
    expect(causa.valor).not.toContain("25");
  });

  it("sin historia suficiente dice que hoy se estimaría sobre la geometría", () => {
    const a = avisoVentanasDesalineadas(
      [{ ...GRUPO, baseHoy: "estimada_geometria" }],
      AHORA,
      1013,
    );
    expect(a.mediciones.find((m) => m.etiqueta === "Por qué cambió")!.valor).toContain(
      "geometría",
    );
  });
});

describe("la congelada del grupo es un rango, no una representante", () => {
  it("cuando todas coinciden dice un número solo", () => {
    const fila = avisoVentanasDesalineadas([GRUPO], AHORA, 1013).tabla!.filas[0]!;
    expect(fila).toContain("60 min");
  });

  it("cuando el grupo mezcla ventanas, dice el rango completo", () => {
    const mezclado = { ...GRUPO, congeladaMin: 60, congeladaMax: 120 };
    const fila = avisoVentanasDesalineadas([mezclado], AHORA, 1013).tabla!.filas[0]!;
    // 38 de 47 grupos reales son así. Decir «60 min» aquí sería falso para casi
    // todos los servicios del grupo.
    expect(fila).toContain("60–120 min");
    expect(fila).not.toContain("60 min");
  });
});

describe("el conteo se lee con su universo", () => {
  it("dice cuántos de cuántos revisados, y qué porción es", () => {
    const m = avisoVentanasDesalineadas([GRUPO], AHORA, 1013).mediciones.find(
      (x) => x.etiqueta === "Servicios sin sellar",
    )!;
    // Sin el denominador, «21 servicios» no dice si es mucho o poco.
    expect(m.lectura).toContain("1013");
    expect(m.lectura).toContain("2.1 %");
  });
});

describe("el asunto nombra el campo correcto", () => {
  it("dice ventana, no hora límite — son dos campos con dos arreglos", () => {
    const asunto = asuntoDe(avisoVentanasDesalineadas([GRUPO], AHORA, 1013));
    expect(asunto).toContain("Ventana");
    expect(asunto).not.toContain("Hora límite");
  });
});

describe("la tabla llega al correo en las dos formas", () => {
  it("el texto plano alinea las columnas y trae todas las filas", () => {
    const a = avisoVentanasDesalineadas([GRUPO, OTRO], AHORA, 1013);
    const { texto: plano } = renderAvisos([a], AHORA, PIE_HORAS_LIMITE);
    expect(plano).toContain("DESGLOSE POR RUTA Y TURNO");
    expect(plano).toContain("Ruta de ejemplo");
    expect(plano).toContain("Otra ruta");
  });

  it("el HTML la manda como tabla, no como lista de viñetas", () => {
    const a = avisoVentanasDesalineadas([GRUPO], AHORA, 1013);
    const { html } = renderAvisos([a], AHORA, PIE_HORAS_LIMITE);
    expect(html).toContain("<th");
    expect(html).toContain("Congelada");
  });
});
