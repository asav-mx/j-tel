import { describe, it, expect } from "vitest";
import {
  evaluarSalud,
  diagnostico,
  UMBRALES_SALUD,
  HORAS_FALLO_MUDO,
  type MuestraSalud,
} from "./salud.js";

const ahora = new Date("2026-07-28T11:26:00.000Z");
const haceMin = (m: number) => new Date(ahora.getTime() - m * 60_000);

const muestra = (over: Partial<MuestraSalud> = {}): MuestraSalud => ({
  ahora,
  marcas: [{ lastRecordedAt: haceMin(3), updatedAt: haceMin(1) }],
  carriersEsperados: 1,
  alertasCriticasAbiertas: 0,
  alertaCriticaMasAntigua: null,
  verificacion: { fallosMudos: 0, masAntiguoHoras: null },
  ...over,
});

const chequeo = (r: ReturnType<typeof evaluarSalud>, id: string) =>
  r.chequeos.find((c) => c.id === id)!;

describe("evaluarSalud", () => {
  it("todo fresco = sano", () => {
    const r = evaluarSalud(muestra());
    expect(r.estado).toBe("sano");
    expect(r.chequeos.every((c) => c.estado === "sano")).toBe(true);
  });

  it("un solo chequeo enfermo enferma el conjunto", () => {
    const r = evaluarSalud(muestra({ alertasCriticasAbiertas: 1, alertaCriticaMasAntigua: haceMin(25) }));
    expect(r.estado).toBe("enfermo");
    expect(chequeo(r, "gps").estado).toBe("sano");
  });

  it("GPS por encima del umbral enferma", () => {
    const r = evaluarSalud(muestra({ marcas: [{ lastRecordedAt: haceMin(21), updatedAt: haceMin(1) }] }));
    expect(chequeo(r, "gps").estado).toBe("enfermo");
    expect(r.estado).toBe("enfermo");
  });

  it("justo en el umbral todavía está sano", () => {
    const r = evaluarSalud(muestra({ marcas: [{ lastRecordedAt: haceMin(20), updatedAt: haceMin(30) }] }));
    expect(chequeo(r, "gps").estado).toBe("sano");
    expect(chequeo(r, "archivador").estado).toBe("sano");
  });

  it("reporta el PEOR carrier, no el promedio", () => {
    const r = evaluarSalud(
      muestra({
        carriersEsperados: 2,
        marcas: [
          { lastRecordedAt: haceMin(1), updatedAt: haceMin(1) },
          { lastRecordedAt: haceMin(200), updatedAt: haceMin(1) },
        ],
      }),
    );
    expect(chequeo(r, "gps").estado).toBe("enfermo");
    expect(chequeo(r, "gps").minutos).toBe(200);
  });

  it("un carrier real sin marca de agua enferma", () => {
    const r = evaluarSalud(muestra({ carriersEsperados: 2 }));
    expect(chequeo(r, "marcas").estado).toBe("enfermo");
    expect(chequeo(r, "marcas").lectura).toContain("faltan 1");
  });

  it("toda lectura lleva su umbral al lado", () => {
    const r = evaluarSalud(muestra({ marcas: [{ lastRecordedAt: haceMin(90), updatedAt: haceMin(90) }] }));
    expect(chequeo(r, "gps").lectura).toContain(`umbral ${UMBRALES_SALUD.gpsMaxMinutos} min`);
    expect(chequeo(r, "archivador").lectura).toContain(
      `umbral ${UMBRALES_SALUD.archivadorMaxMinutos} min`,
    );
  });

  it("sin marcas y sin carriers esperados: solo evalúa alertas", () => {
    const r = evaluarSalud(muestra({ marcas: [], carriersEsperados: 0 }));
    expect(r.estado).toBe("sano");
    expect(r.chequeos.find((c) => c.id === "gps")).toBeUndefined();
  });
});

describe("diagnostico", () => {
  it("GPS fresco = al día", () => {
    expect(diagnostico(evaluarSalud(muestra()))).toContain("al día");
  });

  it("el caso real del 2026-07-28: dato viejo pero archivador escribiendo", () => {
    // 3.4 h de atraso con el archivador escribiendo hace 1 min. Es
    // recuperación, no caída — distinguirlas fue lo difícil ese día.
    const r = evaluarSalud(
      muestra({ marcas: [{ lastRecordedAt: haceMin(204), updatedAt: haceMin(1) }] }),
    );
    expect(r.estado).toBe("enfermo");
    expect(diagnostico(r)).toContain("poniéndose al día");
  });

  it("durante el apagón: dato viejo y archivador callado", () => {
    const r = evaluarSalud(
      muestra({ marcas: [{ lastRecordedAt: haceMin(600), updatedAt: haceMin(600) }] }),
    );
    expect(diagnostico(r)).toContain("detenida");
  });

  it("sin marcas no inventa diagnóstico", () => {
    const r = evaluarSalud(muestra({ marcas: [], carriersEsperados: 0 }));
    expect(diagnostico(r)).toContain("sin marcas");
  });
});

describe("el chequeo que faltaba — servicios vencidos sin veredicto", () => {
  it("uno solo enferma la plataforma: no hay tolerancia", () => {
    // Un servicio sin señal SÍ escribe su hecho. Cero hechos = la verificación
    // reventó, y eso es lo que estuvo mudo 35 días.
    const r = evaluarSalud(muestra({ verificacion: { fallosMudos: 1, masAntiguoHoras: 840 } }));
    expect(chequeo(r, "verificacion").estado).toBe("enfermo");
    expect(r.estado).toBe("enfermo");
  });

  it("el motor manda sobre la ingesta en el diagnóstico", () => {
    // Que la telemetría entre puntual no consuela si nadie dicta veredictos.
    const r = evaluarSalud(muestra({ verificacion: { fallosMudos: 8, masAntiguoHoras: 840 } }));
    expect(diagnostico(r)).toContain("8 servicios");
    expect(diagnostico(r)).not.toContain("ingesta al día");
  });

  it("la lectura trae la medición junto a su umbral", () => {
    const sano = chequeo(evaluarSalud(muestra()), "verificacion");
    expect(sano.lectura).toContain(`${HORAS_FALLO_MUDO} h`);
    expect(sano.umbralMinutos).toBe(HORAS_FALLO_MUDO * 60);
  });

  it("SIN el conteo, la salud NO se da por buena", () => {
    /*
     * La valla de este PR. Si el conteo no llega —consulta caída, refactor que
     * la olvida— la respuesta honesta es "no sé", y "no sé" no es "sano". Un
     * vigilante que calla lo que no midió es el que dejó pasar los 35 días.
     */
    const sinConteo = muestra();
    delete (sinConteo as Partial<MuestraSalud>).verificacion;
    const r = evaluarSalud(sinConteo);
    expect(chequeo(r, "verificacion").estado).toBe("enfermo");
    expect(r.estado).toBe("enfermo");
    expect(diagnostico(r)).toContain("no se pudo contar");
  });
});
