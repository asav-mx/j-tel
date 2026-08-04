import { describe, expect, it } from "vitest";
import {
  PUSH_CUERPO_MAX,
  PUSH_TITULO_MAX,
  correoAvisoOperativo,
  correoCierre,
  correoPendientes,
  correoSistemaCaido,
  pushCierre,
  pushPendientes,
  pushSistemaCaido,
} from "./index";

/**
 * Lo que se prueba aquí no es que el HTML se arme: es que el correo **no
 * afirme de más**. Un correo se reenvía, se imprime y se archiva; una frase
 * falsa dentro de uno sobrevive fuera del sistema y reaparece en una discusión
 * de facturación meses después.
 */

const SELLADO = new Date("2026-07-24T13:50:00.000Z");
const FECHA = new Date("2026-07-24T12:00:00.000Z");

const cierreBase = {
  cuenta: "Planta 47",
  turno: "Primer turno",
  fecha: FECHA,
  selladoEn: SELLADO,
  politica: "v3",
  cumplidos: 12,
  total: 14,
  excepciones: [
    {
      servicio: "Ruta poniente",
      chip: { texto: "No cumplido", tono: "rojo" as const },
      medida: "llegó 07:14:22 · hora límite 06:45:00",
    },
    {
      servicio: "Ruta norte",
      chip: { texto: "Pendiente por evidencia", tono: "ambar" as const },
      medida: "cobertura 46.7% · mínimo del contrato 80.0%",
    },
  ],
  pendientes: 1,
  urlCierre: "https://portal.j-telemetry.com/cierre",
  rol: "Cumplimiento",
  contrato: "Transporte Personal 2026",
};

describe("correo de cierre", () => {
  it("el asunto se puede leer sin abrir y buscar dentro de un año", () => {
    const m = correoCierre(cierreBase);
    // Cuenta, fecha completa y el resultado — nunca "tienes una notificación".
    expect(m.asunto).toContain("Planta 47");
    expect(m.asunto).toContain("2026-07-24");
    expect(m.asunto).toContain("12 de 14");
    expect(m.asunto).toMatch(/2 excepciones/);
  });

  it("llega también cuando todo salió bien, y lo dice como tal", () => {
    const m = correoCierre({ ...cierreBase, excepciones: [], pendientes: 0, cumplidos: 14 });
    expect(m.asunto).toContain("cerró limpio");
    expect(m.html).toContain("Cerró limpio");
  });

  it("lista solo las excepciones y resume los cumplidos en una línea", () => {
    const m = correoCierre(cierreBase);
    expect(m.html).toContain("Ruta poniente");
    expect(m.html).toContain("Ruta norte");
    expect(m.html).toContain("Los otros 12 servicios cumplieron");
  });

  it("si hay pendientes, dice que no cuentan como incumplimiento", () => {
    const m = correoCierre(cierreBase);
    expect(m.html).toContain("no cuentan como incumplimiento ni como cumplido");
  });

  it("el sello viaja dentro del cuerpo, no solo en el pie de la plataforma", () => {
    const m = correoCierre(cierreBase);
    expect(m.html).toContain("Verificado y sellado");
    expect(m.html).toContain("política v3");
    expect(m.texto).toContain("Verificado y sellado");
  });
});

describe("correo de pendientes", () => {
  const base = {
    cuenta: "Planta 47",
    fecha: FECHA,
    servicios: [
      {
        servicio: "Ruta norte",
        chip: { texto: "Pendiente por evidencia", tono: "ambar" as const },
        medida: "cobertura 46.7% · mínimo del contrato 80.0%",
      },
    ],
    urlBandeja: "https://portal.j-telemetry.com/pendientes",
    rol: "Cumplimiento",
    contrato: "Transporte Personal 2026",
  };

  it("lleva el lede obligatorio antes que cualquier dato", () => {
    const m = correoPendientes(base);
    expect(m.html).toContain("No cuentan como incumplimiento ni como cumplido");
  });

  it("NO promete una fecha límite que nadie acordó", () => {
    const m = correoPendientes(base);
    // Ni "Acción requerida" ni un plazo en el asunto: el plazo del pendiente
    // sigue sin existir como regla. Un correo archivado con una fecha falsa
    // sobrevive fuera del sistema.
    expect(m.asunto).not.toMatch(/acción requerida/i);
    expect(m.asunto).not.toMatch(/vence|cierra el|48\s*h/i);
    expect(m.html).toContain("está en definición");
  });

  it("dice que se verifican solos si llega el archivo", () => {
    const m = correoPendientes(base);
    expect(m.html).toContain("se verifican solos");
  });

  it("agrupa varios servicios en un correo, no uno por servicio", () => {
    const m = correoPendientes({
      ...base,
      servicios: [base.servicios[0]!, { ...base.servicios[0]!, servicio: "Ruta sur" }],
    });
    expect(m.asunto).toContain("2 servicios pendientes");
    expect(m.html).toContain("Ruta sur");
  });
});

describe("aviso operativo al carrier", () => {
  const base = {
    cuenta: "Juárez Bus",
    fecha: FECHA,
    titulo: "Una unidad operó sin declararse",
    hecho: "El sistema registra que la unidad operó en el primer turno.",
    medidas: [{ etiqueta: "Unidad", valor: "sin declarar", lectura: "detectada por telemetría" }],
    urlResolver: "https://carrier.j-telemetry.com/declarar",
    urlInvestigar: "https://carrier.j-telemetry.com/recorrido",
    rol: "Operación",
    contrato: "Transporte Personal 2026",
  };

  it("va en acero: no es el resultado de ningún servicio", () => {
    const m = correoAvisoOperativo(base);
    expect(m.html).toContain("Aviso operativo");
    // Ni rojo ni verde ni ámbar de veredicto en el chip.
    expect(m.html).not.toContain("#b4262b");
    expect(m.html).not.toContain("#1b8a54");
  });

  it("no acusa, y explica por qué conviene hoy sin regañar", () => {
    const m = correoAvisoOperativo(base);
    expect(m.html).toContain("no acusa a nadie");
    expect(m.html).toContain("queda registrado como tardío");
  });

  it("reafirma la frontera de confidencialidad en cada contacto", () => {
    const m = correoAvisoOperativo(base);
    expect(m.html).toContain("no ven tus asignaciones ni tu operación interna");
  });
});

describe("correo de sistema caído", () => {
  const base = {
    cuenta: "Planta 47",
    ultimaLectura: new Date("2026-07-24T11:12:00.000Z"),
    sinSenalDesde: "2 h 14 min",
    unidadesAfectadas: 8,
    serviciosEnRiesgo: 3,
    urlEstado: "https://portal.j-telemetry.com/estado",
  };

  it("la negación va antes que cualquier dato", () => {
    const m = correoSistemaCaido(base);
    const negacion = m.html.indexOf("no significa que las unidades no salieron");
    const alcance = m.html.indexOf("El alcance");
    expect(negacion).toBeGreaterThan(-1);
    expect(negacion).toBeLessThan(alcance);
  });

  it("va en ámbar, nunca en rojo: no hay veredicto que dar", () => {
    const m = correoSistemaCaido(base);
    expect(m.html).not.toContain("#b4262b");
    expect(m.html).toContain("#9a6a05");
  });

  it("dice qué pasa si se resuelve, no solo qué se pierde", () => {
    const m = correoSistemaCaido(base);
    expect(m.html).toContain("se verifican con normalidad");
  });

  it("es el único sin pie de procedencia: no se puede desactivar", () => {
    const m = correoSistemaCaido(base);
    expect(m.html).not.toContain("Te llega porque tienes el rol");
    expect(m.html).toContain("no se puede desactivar");
  });
});

describe("todos los correos", () => {
  const todos = [
    correoCierre(cierreBase),
    correoPendientes({
      cuenta: "Planta 47",
      fecha: FECHA,
      servicios: [],
      urlBandeja: "u",
      rol: "r",
      contrato: "c",
    }),
    correoAvisoOperativo({
      cuenta: "Juárez Bus",
      fecha: FECHA,
      titulo: "t",
      hecho: "h",
      medidas: [],
      urlResolver: "a",
      urlInvestigar: "b",
      rol: "r",
      contrato: "c",
    }),
    correoSistemaCaido({
      cuenta: "Planta 47",
      ultimaLectura: SELLADO,
      sinSenalDesde: "1 h",
      unidadesAfectadas: 1,
      serviciosEnRiesgo: 1,
      urlEstado: "u",
    }),
  ];

  it("van en tema claro: un correo oscuro se imprime como plancha negra", () => {
    for (const m of todos) {
      expect(m.html).toContain("#f4f6f8");
      expect(m.html).not.toContain("#0A0D10");
      expect(m.html).not.toContain("#0F1318");
    }
  });

  it("ninguno promete un enlace de preferencias que no existe", () => {
    for (const m of todos) {
      expect(m.html).not.toMatch(/ajustar (tus )?preferencias|darte de baja|cancelar suscripción/i);
    }
  });

  it("todos traen su versión de texto plano", () => {
    for (const m of todos) {
      expect(m.texto.length).toBeGreaterThan(0);
      expect(m.texto).not.toContain("<");
    }
  });

  /**
   * El bug que esta prueba existe para no repetir.
   *
   * La pila de fuentes venía con comillas dobles —`"IBM Plex Sans", …`— dentro
   * de un atributo `style="…"`, que también se delimita con comillas dobles. El
   * atributo se cerraba en la primera comilla de la fuente, así que **todo lo
   * declarado después de `font-family:` se perdía**: tamaños, colores,
   * interlineados, alineaciones. El correo seguía viéndose "bien" de lejos
   * porque lo que va antes sí aplicaba, y solo se cayó al medir el
   * `font-family` computado en un navegador: decía `Times`.
   *
   * Ninguna prueba de contenido lo habría encontrado. Esta mide la forma.
   */
  it("ningún atributo style se corta: las comillas de la fuente no cierran el atributo", () => {
    for (const m of todos) {
      for (const [, valor] of m.html.matchAll(/style="([^"]*)"/g)) {
        // Un `style` sano nunca termina en `font-family:` a medias.
        expect(valor.trimEnd()).not.toMatch(/font-family:\s*$/);
      }
      // Y donde se declara una fuente, el resto del estilo sigue vivo.
      const conFuente = [...m.html.matchAll(/style="([^"]*font-family:[^"]*)"/g)];
      expect(conFuente.length).toBeGreaterThan(0);
      for (const [, valor] of conFuente) {
        expect(valor).toMatch(/font-family:[^;]+;/);
      }
    }
  });
});

describe("push móvil", () => {
  it("respeta los topes: lo que se corta es siempre el final, donde está el dato", () => {
    const casos = [
      pushCierre(cierreBase),
      pushPendientes(3),
      pushSistemaCaido(new Date("2026-07-24T11:12:00.000Z")),
    ];
    for (const p of casos) {
      expect(p.titulo.length).toBeLessThanOrEqual(PUSH_TITULO_MAX);
      expect(p.cuerpo.length).toBeLessThanOrEqual(PUSH_CUERPO_MAX);
    }
  });

  it("se sostiene sin abrirse: el título trae el resultado", () => {
    expect(pushCierre(cierreBase).titulo).toContain("12 de 14");
    expect(pushPendientes(3).titulo).toContain("3 pendientes");
    expect(pushSistemaCaido(new Date("2026-07-24T11:12:00.000Z")).titulo).toContain(
      "Sin telemetría",
    );
  });

  it("el push de pendientes tampoco convierte el pendiente en falla", () => {
    expect(pushPendientes(3).cuerpo).toContain("No cuentan como incumplimiento");
  });

  it("recorta en límite de palabra, no a media cifra", () => {
    const p = pushCierre({
      ...cierreBase,
      excepciones: Array.from({ length: 6 }, (_, i) => ({
        servicio: `Ruta muy larga número ${i}`,
        chip: { texto: "No cumplido", tono: "rojo" as const },
        medida: "x",
      })),
    });
    expect(p.cuerpo.length).toBeLessThanOrEqual(PUSH_CUERPO_MAX);
    expect(p.cuerpo.endsWith("…")).toBe(true);
    expect(p.cuerpo).not.toMatch(/\s…$/);
  });
});
