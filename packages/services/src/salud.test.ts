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

/* Una unidad en turno, hablando. `ahora` es 05:26 en Juárez: dentro de 05:00–22:00. */
const UNIDAD = (minutosSinHablar: number | null = 3) => ({
  unidad: "2120",
  carrier: "Juárez Bus",
  circuito: "Oasis-Centro",
  abre: "05:00:00",
  cierra: "22:00:00",
  zona: "America/Ciudad_Juarez",
  arrancaEl: null,
  minutosSinHablar,
});

const muestra = (over: Partial<MuestraSalud> = {}): MuestraSalud => ({
  ahora,
  marcas: [{ lastRecordedAt: haceMin(3), updatedAt: haceMin(1) }],
  carriersEsperados: 1,
  alertasCriticasAbiertas: 0,
  alertaCriticaMasAntigua: null,
  verificacion: { fallosMudos: 0, masAntiguoHoras: null },
  flota: [UNIDAD()],
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
    expect(chequeo(r, "flota").estado).toBe("sano");
  });

  it("una unidad en turno por encima del umbral enferma", () => {
    const r = evaluarSalud(muestra({ flota: [UNIDAD(21)] }));
    expect(chequeo(r, "flota").estado).toBe("enfermo");
    expect(r.estado).toBe("enfermo");
  });

  it("justo en el umbral todavía está sano", () => {
    const r = evaluarSalud(
      muestra({ flota: [UNIDAD(20)], marcas: [{ lastRecordedAt: haceMin(20), updatedAt: haceMin(30) }] }),
    );
    expect(chequeo(r, "flota").estado).toBe("sano");
    expect(chequeo(r, "archivador").estado).toBe("sano");
  });

  it("reporta la PEOR de las que callan, no el promedio", () => {
    const r = evaluarSalud(muestra({ flota: [UNIDAD(1), UNIDAD(200)] }));
    expect(chequeo(r, "flota").estado).toBe("enfermo");
    expect(chequeo(r, "flota").minutos).toBe(200);
  });

  /* ── El #470, en el evaluador ─────────────────────────────────────────── */

  /*
   * El caso exacto del incidente: la flota estacionada y apagada, con 68 h sin
   * dato, **fuera de horario**. Antes esto era un 503 y tres días de gritos.
   */
  it("#470 · flota fuera de horario: informativo, NO enferma", () => {
    const deMadrugada = new Date("2026-07-28T09:00:00.000Z"); // 03:00 en Juárez
    const r = evaluarSalud(
      muestra({
        ahora: deMadrugada,
        flota: [{ ...UNIDAD(68 * 60), abre: "09:53:00" }],
        marcas: [{ lastRecordedAt: new Date(deMadrugada.getTime() - 68 * 3600_000), updatedAt: haceMin(1) }],
      }),
    );
    expect(chequeo(r, "flota").estado).toBe("sano");
    expect(chequeo(r, "flota").lectura).toContain("fuera de horario");
    expect(r.estado).toBe("sano");
  });

  /*
   * Y el otro lado: en turno y callada sí grita, **nombrando a quién**. Sin
   * esto, «no grita cuando duerme» se podría cumplir no gritando nunca.
   */
  it("#470 · en turno y callada: enferma, y dice qué unidad", () => {
    const r = evaluarSalud(muestra({ flota: [UNIDAD(68 * 60)] }));
    expect(chequeo(r, "flota").estado).toBe("enfermo");
    expect(chequeo(r, "flota").lectura).toContain("2120");
    expect(chequeo(r, "flota").lectura).toContain("Oasis-Centro");
  });

  /*
   * La frase ya no puede decir «dato de GPS más nuevo hace 68 h» cuando el
   * dato más nuevo tiene minutos. Esa oración era el defecto.
   */
  it("#470 · la lectura no habla de «dato más nuevo»: habla de quién calla", () => {
    const r = evaluarSalud(muestra({ flota: [UNIDAD(1), UNIDAD(68 * 60)] }));
    expect(chequeo(r, "flota").lectura).not.toContain("más nuevo");
  });

  /*
   * El archivador es UN proceso: si escribió para alguien hace un minuto, está
   * vivo, aunque otro carrier lleve tres días sin darle nada que escribir.
   */
  it("#470 · un carrier dormido no declara muerto al archivador", () => {
    const r = evaluarSalud(
      muestra({
        carriersEsperados: 2,
        marcas: [
          { lastRecordedAt: haceMin(1), updatedAt: haceMin(1) },
          { lastRecordedAt: haceMin(68 * 60), updatedAt: haceMin(68 * 60) },
        ],
      }),
    );
    expect(chequeo(r, "archivador").estado).toBe("sano");
  });

  /* Lo que no se pudo mirar no se da por bueno. */
  it("sin flota que leer, el chequeo se declara no medido", () => {
    const r = evaluarSalud(muestra({ flota: undefined }));
    expect(chequeo(r, "flota").estado).toBe("no_medido");
    expect(r.estado).toBe("enfermo");
  });

  it("un carrier real sin marca de agua enferma", () => {
    const r = evaluarSalud(muestra({ carriersEsperados: 2 }));
    expect(chequeo(r, "marcas").estado).toBe("enfermo");
    expect(chequeo(r, "marcas").lectura).toContain("faltan 1");
  });

  it("toda lectura lleva su umbral al lado", () => {
    const r = evaluarSalud(muestra({ marcas: [{ lastRecordedAt: haceMin(90), updatedAt: haceMin(90) }] }));
    expect(chequeo(r, "flota").lectura).toContain(`umbral ${UMBRALES_SALUD.gpsMaxMinutos} min`);
    expect(chequeo(r, "archivador").lectura).toContain(
      `umbral ${UMBRALES_SALUD.archivadorMaxMinutos} min`,
    );
  });

  it("sin marcas y sin carriers esperados no hay chequeo de archivador", () => {
    const r = evaluarSalud(muestra({ marcas: [], carriersEsperados: 0 }));
    expect(r.estado).toBe("sano");
    expect(r.chequeos.find((c) => c.id === "archivador")).toBeUndefined();
  });
});

describe("diagnostico", () => {
  it("unidades en turno hablando = al día", () => {
    expect(diagnostico(evaluarSalud(muestra()))).toContain("al día");
  });

  it("el caso real del 2026-07-28: la unidad calla, y el diagnóstico la nombra", () => {
    const r = evaluarSalud(
      muestra({
        flota: [UNIDAD(204)],
        marcas: [{ lastRecordedAt: haceMin(204), updatedAt: haceMin(1) }],
      }),
    );
    expect(r.estado).toBe("enfermo");
    expect(diagnostico(r)).toContain("2120");
  });

  /*
   * El caso que sólo se ve con las dos mitades juntas: entra dato pero no se
   * guarda. Antes se leía como «poniéndose al día», que es lo contrario.
   */
  it("las unidades hablan y el archivador no escribe: lo que entra no se guarda", () => {
    const r = evaluarSalud(
      muestra({ marcas: [{ lastRecordedAt: haceMin(1), updatedAt: haceMin(600) }] }),
    );
    expect(diagnostico(r)).toContain("no se está guardando");
  });

  it("sin flota que mirar no inventa diagnóstico", () => {
    const r = evaluarSalud(muestra({ flota: undefined, marcas: [], carriersEsperados: 0 }));
    /* Repite la lectura del chequeo en vez de resumirla: una segunda frase
       puede separarse de la primera, y la que se separó costó el #470. */
    expect(diagnostico(r)).toContain("no se pudo leer qué unidades");
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
     * La valla. Si el conteo no llega —consulta caída, refactor que la olvida—
     * la respuesta honesta es "no sé", y "no sé" no es "sano". Un vigilante que
     * calla lo que no midió es el que dejó pasar los 35 días.
     */
    const sinConteo = muestra();
    delete (sinConteo as Partial<MuestraSalud>).verificacion;
    const r = evaluarSalud(sinConteo);
    expect(r.estado).toBe("enfermo");
    expect(diagnostico(r)).toContain("no se pudo contar");
  });

  it("y lo dice como ausencia, no como falla: 'no sé' tiene su propio valor", () => {
    /*
     * El tercer estado. Antes, no poder medir se marcaba `enfermo` — el mismo
     * valor que "lo miré y está roto". Con eso, ningún aviso podía distinguir
     * una violación de umbral de una ceguera, porque no había con qué.
     *
     * El estado GLOBAL sigue siendo binario a propósito: el vigilante externo
     * necesita saber si grita, y ante la duda grita.
     */
    const sinConteo = muestra();
    delete (sinConteo as Partial<MuestraSalud>).verificacion;
    const r = evaluarSalud(sinConteo);
    expect(chequeo(r, "verificacion").estado).toBe("no_medido");
    expect(r.estado).toBe("enfermo");
  });

  it("medir cero NO es lo mismo que no medir", () => {
    // Los dos son "no hay nada que reportar" en el conteo, y son estados
    // distintos: uno lo comprobó y el otro no pudo.
    const medido = chequeo(evaluarSalud(muestra()), "verificacion");
    expect(medido.estado).toBe("sano");
    expect(medido.lectura).toContain("sin servicios vencidos sin veredicto");
  });
});
