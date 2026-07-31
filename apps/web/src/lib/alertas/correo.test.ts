import { describe, it, expect } from "vitest";
import { renderAvisos, renderResumen, type ResumenDiario } from "./correo";
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
    expect(html).toContain("#7A9CB8");
    expect(html).toContain("#4C9AE0");
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
