import { describe, it, expect } from "vitest";
import { evaluarSalud } from "@jtel/services";
import {
  renderAvisos,
  renderResumen,
  PIE_HORAS_LIMITE,
  type ResumenDiario,
} from "./correo";
import type { Aviso } from "./decision";

const T = (iso: string) => new Date(iso);
const AHORA = T("2026-07-31T13:31:00Z");

const aviso = (parcial: Partial<Aviso> = {}): Aviso => ({
  clase: "archivador-callado",
  titulo: "El archivador lleva 47.3 min sin escribir.",
  mediciones: [
    {
      etiqueta: "Silencio del archivador",
      valor: "47.3 min",
      lectura: "umbral 30 min",
    },
  ],
  consecuencia: "La memoria propia deja de crecer.",
  accion: "Revisar la corrida de /api/cron/archive en Vercel · J-Staff",
  instante: AHORA,
  ...parcial,
});

/**
 * La regla del skill que es más fácil romper sin darse cuenta: un aviso de
 * plataforma NO es un veredicto. Si el correo se pinta de rojo por grave que
 * sea, el rojo deja de significar "no cumplido" en todo el producto.
 */
describe("los colores de veredicto no entran a un aviso operativo", () => {
  const VERDICTO = ["#34C77B", "#E3A81F", "#E5484D"];

  it("no aparecen en el aviso inmediato", () => {
    const { html } = renderAvisos([aviso()], AHORA);
    for (const color of VERDICTO) {
      expect(html.toUpperCase()).not.toContain(color);
    }
  });

  it("no aparecen en el resumen diario", () => {
    const { html } = renderResumen(resumen(), AHORA);
    for (const color of VERDICTO) {
      expect(html.toUpperCase()).not.toContain(color);
    }
  });

  it("lo medido va en acero y lo que el sistema pide va en azul", () => {
    const { html } = renderAvisos([aviso()], AHORA);
    // Los tonos claros del acero y del azul: el correo va en tema claro sin
    // importar la preferencia del usuario, porque varios clientes rompen el
    // fondo oscuro y porque un correo puede terminar impreso.
    expect(html).toContain("#3d6a8f");
    expect(html).toContain("#2a6fb5");
  });

  it("va en tema claro: un fondo oscuro se imprime como plancha negra", () => {
    const { html } = renderAvisos([aviso()], AHORA);
    expect(html).toContain("#f4f6f8");
    expect(html).not.toContain("#0A0D10");
    expect(html).not.toContain("#0F1318");
  });
});

describe("todo número viaja con su lectura", () => {
  it("la medición y su umbral salen juntos, no en renglones distintos", () => {
    const { html, texto } = renderAvisos([aviso()], AHORA);

    expect(html).toContain("47.3 min");
    expect(html).toContain("umbral 30 min");
    expect(texto).toContain("47.3 min · umbral 30 min");
  });
});

describe("una corrida manda un solo correo", () => {
  it("junta varios avisos en uno, con el conteo en el asunto", () => {
    const mensaje = renderAvisos(
      [aviso(), aviso({ clase: "ingesta-detenida", titulo: "Ingesta detenida." })],
      AHORA,
    );

    expect(mensaje.asunto).toBe("J-Telemetry · 2 avisos de plataforma");
    expect(mensaje.texto).toContain("El archivador lleva 47.3 min sin escribir.");
    expect(mensaje.texto).toContain("Ingesta detenida.");
  });

  it("con un solo aviso, el asunto es el del aviso", () => {
    expect(renderAvisos([aviso()], AHORA).asunto).toBe("J-Telemetry · Archivador callado");
  });

  it("dice de dónde salió y qué NO avisa, para que el silencio se pueda leer", () => {
    const { texto } = renderAvisos([aviso()], AHORA);

    expect(texto).toContain("/api/cron/alertas");
    expect(texto).toContain("resumen diario");
  });
});

describe("el nombre de una cuenta no puede inyectar marcado", () => {
  it("escapa lo que viene de la base", () => {
    const { html } = renderAvisos(
      [aviso({ titulo: `Servicios de <script>alert("x")</script> sin veredicto.` })],
      AHORA,
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

const resumen = (parcial: Partial<ResumenDiario> = {}): ResumenDiario => ({
  dia: "2026-07-30",
  saludAhora: "sano",
  diagnostico: "ingesta al día",
  chequeos: [
    { id: "gps", estado: "sano", lectura: "dato de GPS más nuevo hace 2.1 min · umbral 20 min" },
    {
      id: "archivador",
      estado: "sano",
      lectura: "archivador escribió hace 4.8 min · umbral 30 min",
    },
  ],
  abiertasPorTipo: [],
  nuevasPorTipo: [],
  sinVeredicto: { total: 0, sinViaje: 0, contratos: 0 },
  diasMirados: 3,
  colaVerificacion: { total: 0 },
  ...parcial,
});

describe("el resumen diario", () => {
  it("en un día sin novedad dice que su ausencia es la señal", () => {
    const { texto, asunto } = renderResumen(resumen(), AHORA);

    expect(asunto).toBe("J-Telemetry · Resumen 2026-07-30");
    expect(texto).toContain("Sin incidentes abiertos");
    expect(texto).toContain("si un día no llega");
  });

  it("declara el corte de días para no leerse como 'no hay nada más'", () => {
    const { texto } = renderResumen(resumen(), AHORA);
    expect(texto).toContain("3 días");
  });

  it("cuenta lo que a propósito no dispara aviso inmediato", () => {
    const { texto } = renderResumen(
      resumen({
        abiertasPorTipo: [{ tipo: "rate_limit", cantidad: 4, masAntigua: T("2026-07-30T09:00:00Z") }],
        nuevasPorTipo: [{ tipo: "archive_error", cantidad: 2 }],
      }),
      AHORA,
    );

    expect(texto).toContain("rate_limit: 4");
    expect(texto).toContain("archive_error: 2");
  });

  it("con faltantes, el titular trae el conteo y no una tranquilidad falsa", () => {
    const { texto } = renderResumen(
      resumen({ sinVeredicto: { total: 7, sinViaje: 3, contratos: 2 } }),
      AHORA,
    );

    expect(texto).toContain("7 servicios sin veredicto");
    expect(texto).toContain("3 sin fila de viaje");
  });
});

/*
 * El título contra las dos poblaciones — el último defecto de C21.
 *
 * El resumen enseñaba «0 incidentes abiertos y 2 servicios sin veredicto» y un
 * renglón más abajo «Cola de verificación: 6». Los dos números medidos y
 * correctos; el titular, falso, porque afirmaba un conteo sin decir de qué
 * recorte era. Quien lo leía entendía "hay 2" y tenía enfrente un 6.
 *
 * Las poblaciones no se contienen en ninguna dirección —ventanas, umbrales y
 * filtros de contrato distintos—, así que no hay un número "bueno" que elegir.
 * Cada uno sale con su corte puesto.
 */
describe("el título no afirma un número que la otra población contradice", () => {
  const dosPoblaciones = resumen({
    saludAhora: "enfermo",
    sinVeredicto: { total: 2, sinViaje: 1, contratos: 1 },
    colaVerificacion: { total: 6 },
  });

  it("el conteo propio nunca sale sin su corte de días", () => {
    const { texto } = renderResumen(dosPoblaciones, AHORA);
    const titulo = texto.split("\n")[0]!;

    expect(titulo).toContain("2 servicios sin veredicto de los últimos 3 días");
    // El defecto exacto: el conteo a secas, que se lee como un total.
    expect(titulo).not.toMatch(/2 servicios sin veredicto[.·]/);
  });

  it("la otra población se declara en el mismo título, con el suyo", () => {
    const { texto } = renderResumen(dosPoblaciones, AHORA);
    const titulo = texto.split("\n")[0]!;

    expect(titulo).toContain("la cola de verificación cuenta 6 sin ventana de días");
  });

  it("el 2 y el 6 conviven sin contradecirse: cada uno dice de dónde sale", () => {
    const { texto } = renderResumen(dosPoblaciones, AHORA);
    const titulo = texto.split("\n")[0]!;

    // La regresión concreta del 15 de agosto, escrita como prueba.
    expect(titulo).toContain("2");
    expect(titulo).toContain("6");
    expect(titulo).toContain("últimos 3 días");
    expect(titulo).toContain("sin ventana de días");
  });

  it("cuando los dos conteos coinciden, NO dice que sean los mismos servicios", () => {
    const { texto } = renderResumen(
      resumen({
        saludAhora: "enfermo",
        sinVeredicto: { total: 6, sinViaje: 0, contratos: 2 },
        colaVerificacion: { total: 6 },
      }),
      AHORA,
    );
    const titulo = texto.split("\n")[0]!;

    // Dos recortes distintos pueden dar 6 por casualidad. "Los mismos 6" sería
    // un dato correcto sosteniendo una afirmación falsa.
    expect(titulo).not.toContain("los mismos");
    expect(titulo).not.toContain("el mismo");
    // Se siguen declarando los dos, con su corte: la forma del titular no
    // cambia porque los números coincidan.
    expect(titulo).toContain("6 servicios sin veredicto de los últimos 3 días");
    expect(titulo).toContain("la cola de verificación cuenta 6 sin ventana de días");
  });

  it("el día limpio sigue siendo una sola frase, sin conteos que reconciliar", () => {
    const { texto } = renderResumen(resumen(), AHORA);
    const titulo = texto.split("\n")[0]!;

    expect(titulo).toBe(
      "Sin incidentes abiertos. La ingesta, el archivador y la cola de verificación están al día.",
    );
  });

  it("con cero propio y cola con hallazgos, el titular deja de leerse como 'no hay nada'", () => {
    // El caso que más engaña: todo lo del recorte de 3 días en cero, y 6
    // esperando fuera de esa ventana.
    const { texto } = renderResumen(
      resumen({ saludAhora: "enfermo", colaVerificacion: { total: 6 } }),
      AHORA,
    );
    const titulo = texto.split("\n")[0]!;

    expect(titulo).not.toContain("Sin incidentes abiertos");
    expect(titulo).toContain("la cola de verificación cuenta 6 sin ventana de días");
  });
});

/*
 * El correo tiene que poder decir "no sé".
 *
 * El 15 de agosto salió con un chequeo que no se pudo hacer y lo dijo con las
 * mismas dos palabras que usa para un umbral roto —"fuera de umbral"—, bajo un
 * título que afirmaba cero de todo. Una ceguera pintada como una violación, y
 * una tranquilidad que nadie había medido.
 */
const sinMedir: ResumenDiario["chequeos"][number] = {
  id: "verificacion",
  estado: "no_medido",
  lectura: "no se pudo contar los servicios vencidos sin veredicto",
};

/** Los renglones del bloque EVIDENCIA, ya partidos en etiqueta y resto. */
const etiquetasDeEvidencia = (texto: string): string[] =>
  texto
    .split("EVIDENCIA")[1]!
    .split("CONSECUENCIA")[0]!
    .trim()
    .split("\n")
    .map((l) => l.split(":")[0]!.trim());

describe("cada renglón lleva el nombre de la población que reporta", () => {
  /*
   * Los chequeos salen de `evaluarSalud` de verdad, no de una lista escrita a
   * mano: si mañana nace un chequeo nuevo, aparece aquí solo y estas pruebas se
   * enteran. Una lista copiada no se habría enterado — que es exactamente cómo
   * el chequeo de verificación pasó meses con el nombre de otra población.
   */
  const completos = evaluarSalud({
    ahora: AHORA,
    marcas: [{ lastRecordedAt: T("2026-07-31T13:29:00Z"), updatedAt: T("2026-07-31T13:30:00Z") }],
    carriersEsperados: 1,
    alertasCriticasAbiertas: 0,
    alertaCriticaMasAntigua: null,
    verificacion: { fallosMudos: 0, masAntiguoHoras: null },
  }).chequeos.map((c) => ({ id: c.id, estado: c.estado, lectura: c.lectura }));

  it("ningún renglón del correo repite el nombre de otro", () => {
    // El defecto, dicho como propiedad: dos renglones con el mismo nombre son
    // dos poblaciones distintas presentadas como si fueran la misma.
    const etiquetas = etiquetasDeEvidencia(renderResumen(resumen({ chequeos: completos }), AHORA).texto);

    expect(new Set(etiquetas).size).toBe(etiquetas.length);
  });

  it("el chequeo de verificación tiene nombre propio, no el de las alertas", () => {
    const { texto } = renderResumen(resumen({ chequeos: completos }), AHORA);
    const etiquetas = etiquetasDeEvidencia(texto);

    expect(etiquetas).toContain("Cola de verificación");
    expect(etiquetas.filter((e) => e === "Alertas críticas")).toHaveLength(1);
  });

  it("ningún chequeo sale rotulado con su id crudo", () => {
    // El respaldo de `ETIQUETA_CHEQUEO` es mostrar el id: feo y evidente. Que
    // se vea aquí significaría que un chequeo se quedó sin nombre.
    const etiquetas = etiquetasDeEvidencia(renderResumen(resumen({ chequeos: completos }), AHORA).texto);

    for (const c of completos) expect(etiquetas).not.toContain(c.id);
  });
});

/*
 * El chequeo ciego es el de la cola, así que `colaVerificacion` va en `null`:
 * ese es el par que arma `armarResumen` de verdad. Si un día llegara un número
 * junto a un renglón que dice "no medido", el título afirmaría un conteo que
 * el desglose desmiente — la contradicción que el PR 4 quita, al revés.
 */
const resumenCiego = (parcial: Partial<ResumenDiario> = {}) =>
  resumen({ chequeos: [sinMedir], saludAhora: "enfermo", colaVerificacion: null, ...parcial });

describe("cuando un chequeo no se pudo medir", () => {
  it("la medición se enuncia como hueco, no como falla de umbral", () => {
    const { texto } = renderResumen(resumenCiego(), AHORA);

    expect(texto).toContain("no medido");
    expect(texto).not.toContain("fuera de umbral");
  });

  it("el título no afirma un conteo que nadie pudo hacer", () => {
    const { texto } = renderResumen(resumenCiego(), AHORA);

    expect(texto).toContain("no se pudo medir");
    // Ni la tranquilidad falsa del día limpio, ni el "0 y 0" que se leía como
    // "no hay nada" cuando lo que había era un instrumento ciego.
    expect(texto).not.toContain("Sin incidentes abiertos");
    expect(texto).not.toContain("0 incidentes abiertos y 0 servicios sin veredicto");
    // Tampoco un conteo de la cola: si no se pudo contar, no hay número.
    expect(texto).not.toContain("la cola de verificación cuenta");
  });

  it("tampoco dice que no haya nada que hacer", () => {
    const { texto } = renderResumen(resumenCiego(), AHORA);

    expect(texto).not.toContain("Nada que hacer");
    expect(texto).toContain("Revisar por qué el chequeo no pudo medirse");
  });

  it("lo que SÍ se midió se sigue diciendo con su número", () => {
    const { texto } = renderResumen(
      resumenCiego({
        abiertasPorTipo: [{ tipo: "rate_limit", cantidad: 4, masAntigua: T("2026-07-30T09:00:00Z") }],
      }),
      AHORA,
    );

    expect(texto).toContain("4 incidentes abiertos");
    expect(texto).toContain("sin medir, así que puede haber más");
  });

  it("un chequeo ciego no esconde el conteo de la cola cuando ese SÍ se midió", () => {
    // El ciego es el GPS; la cola se contó y dio 6. Callar el 6 por el hueco
    // del GPS sería el error simétrico del que este correo ya se cuida.
    const { texto } = renderResumen(
      resumen({
        chequeos: [{ id: "gps", estado: "no_medido", lectura: "no se pudo leer la marca de GPS" }],
        saludAhora: "enfermo",
        colaVerificacion: { total: 6 },
      }),
      AHORA,
    );
    const titulo = texto.split("\n")[0]!;

    expect(titulo).toContain("no se pudo medir");
    expect(titulo).toContain("la cola de verificación cuenta 6 sin ventana de días");
  });

  it("y con incidentes abiertos, las tres piezas conviven en un solo titular", () => {
    const { texto } = renderResumen(
      resumen({
        chequeos: [{ id: "gps", estado: "no_medido", lectura: "no se pudo leer la marca de GPS" }],
        saludAhora: "enfermo",
        abiertasPorTipo: [{ tipo: "rate_limit", cantidad: 4, masAntigua: T("2026-07-30T09:00:00Z") }],
        colaVerificacion: { total: 6 },
      }),
      AHORA,
    );
    const titulo = texto.split("\n")[0]!;

    // Lo medido, la otra población, y el hueco declarado: ninguna se calla por
    // culpa de otra.
    expect(titulo).toContain("4 incidentes abiertos");
    expect(titulo).toContain("la cola de verificación cuenta 6 sin ventana de días");
    expect(titulo).toContain("sin medir, así que puede haber más");
  });

  it("no se pinta con el color de lo medido: el acero afirmaría que ahí hay un dato", () => {
    const ciego = renderResumen(resumenCiego(), AHORA);
    const roto = renderResumen(
      resumen({
        chequeos: [{ id: "gps", estado: "enfermo", lectura: "dato de GPS más nuevo hace 91.4 min · umbral 20 min" }],
        saludAhora: "enfermo",
      }),
      AHORA,
    );

    // Una violación de umbral es una medición, y va en acero como toda medición.
    expect(roto.html).toContain(`<span style="color:#3d6a8f">fuera de umbral</span>`);
    // Un hueco no lo es: va en tenue y con el punteado, que sobrevive incluso a
    // un cliente de correo que reescriba los colores.
    expect(ciego.html).toContain(
      `<span style="color:#5a6874;border-bottom:1px dotted #5a6874">no medido</span>`,
    );
  });
});

describe("el pie dice de qué corrida viene", () => {
  const deHoraLimite: Aviso = {
    clase: "hora-limite-vieja",
    titulo: "Un servicio va a juzgarse con una hora límite vieja.",
    mediciones: [{ etiqueta: "Servicios sin sellar", valor: "1", lectura: "de 500 revisados" }],
    consecuencia: "Se sella contra una ventana que ya no es la del turno.",
    accion: "Decidir si se corrigen · Asav",
    instante: new Date("2026-08-09T17:45:00Z"),
  };
  const ahora = new Date("2026-08-07T18:00:00Z");

  it("firma la ruta que hizo la corrida, no otra", () => {
    // El pie de un cron es falso en el correo de otro: dice quién lo mandó y
    // qué avisa, y las dos cosas cambian. Es §D del Marco en el pie.
    const propio = renderAvisos([deHoraLimite], ahora, PIE_HORAS_LIMITE);

    expect(propio.texto).toContain("/api/cron/revisar-horas-limite");
    expect(propio.texto).not.toContain("/api/cron/alertas");
    expect(propio.html).toContain("/api/cron/revisar-horas-limite");
  });

  it("no promete el alcance del otro canal", () => {
    const propio = renderAvisos([deHoraLimite], ahora, PIE_HORAS_LIMITE);

    expect(propio.texto).not.toContain("archivador callado");
    expect(propio.texto).toContain("Avisa; no corrige");
  });

  it("sin pie explícito sigue firmando el canal de alertas — nadie lo tiene que recordar", () => {
    expect(renderAvisos([deHoraLimite], ahora).texto).toContain("/api/cron/alertas");
  });
});
