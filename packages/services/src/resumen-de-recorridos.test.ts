import { describe, expect, it, vi } from "vitest";
import { ResumenDeRecorridosService, VENTANA_DIAS } from "./resumen-de-recorridos.js";
import { VERSION_DEL_DETECTOR } from "./orquestador-de-pasos.js";

/*
 * El servicio del resumen (0053; 8.16.5): lee pasos, agrega y REEMPLAZA. Lo
 * que se prueba aquí es lo suyo —la ventana, la versión del detector, el
 * reemplazo y la simulación—; la aritmética tiene sus pruebas en el dominio.
 */

const AHORA = new Date("2026-09-22T12:00:00Z");
const T0 = Date.UTC(2026, 8, 20, 6, 0, 0);

/** `n` travesías A→B de una misma cadena, de `duracion` segundos. */
const pasos = (n: number, duracion = 300, version = VERSION_DEL_DETECTOR) =>
  Array.from({ length: n }, (_, i) => {
    const t = T0 + i * 3600_000;
    return [
      { cadena: 1, sentido: "ida" as const, parada: "A", stopId: "id-A", orden: 1, desde: new Date(t), hasta: new Date(t + 20_000), detectorVersion: version },
      { cadena: 1, sentido: "ida" as const, parada: "B", stopId: "id-B", orden: 2, desde: new Date(t + 320_000), hasta: new Date(t + 340_000), detectorVersion: version },
    ];
  }).flat();

function repos(lectura: ReturnType<typeof pasos>) {
  const guardarRecorridos = vi.fn(async (_c: string, tramos: unknown[]) => tramos.length);
  const pasosParaElResumen = vi.fn(async () => lectura);
  return {
    guardarRecorridos,
    pasosParaElResumen,
    repos: {
      circuits: {
        listPublishedCircuits: async () => [{ publicSlug: "zaragoza-centro" }],
        getPublishedCircuitBySlug: async () => ({ id: "c1", publicSlug: "zaragoza-centro" }),
        guardarRecorridos,
      },
      pasosPorParada: { pasosParaElResumen },
    },
  };
}

describe("el resumen de los recorridos", () => {
  it("lee la ventana de los últimos 7 días y escribe el tramo con sus travesías", async () => {
    const r = repos(pasos(10));
    const ronda = await new ResumenDeRecorridosService(r.repos, () => AHORA).correr();
    expect(r.pasosParaElResumen.mock.calls[0]).toEqual([
      "c1",
      new Date(AHORA.getTime() - VENTANA_DIAS * 86_400_000),
      AHORA,
    ]);
    expect(ronda).toMatchObject({ circuitos: 1, pasos: 20, tramos: 1, escritos: 1, simulado: false });
    const escrito = (r.guardarRecorridos.mock.calls[0]![1] as Array<Record<string, unknown>>)[0]!;
    expect(escrito).toMatchObject({
      sentido: "ida",
      deStopId: "id-A",
      aStopId: "id-B",
      travesias: 10,
      detectorVersion: VERSION_DEL_DETECTOR,
    });
    // Nada de la unidad, ni de su cadena anónima, llega a lo que se guarda.
    expect(JSON.stringify(escrito)).not.toMatch(/cadena|unidad|unit/);
  });

  it("los pasos de OTRA versión del detector no se mezclan: sus corridas se apilan, no se pisan", async () => {
    const r = repos([...pasos(10), ...pasos(10, 900, "detector-viejo")]);
    const ronda = await new ResumenDeRecorridosService(r.repos, () => AHORA).correr();
    expect(ronda.tramos).toBe(1);
    const escrito = (r.guardarRecorridos.mock.calls[0]![1] as Array<Record<string, unknown>>)[0]!;
    expect(escrito.travesias).toBe(10); // no 20
  });

  it("con pocas travesías no escribe ningún tramo, y reemplaza el resumen viejo por nada", async () => {
    const r = repos(pasos(9));
    const ronda = await new ResumenDeRecorridosService(r.repos, () => AHORA).correr();
    expect(ronda.tramos).toBe(0);
    // Se llama IGUAL con la lista vacía: un tramo que dejó de medirse desaparece.
    expect(r.guardarRecorridos).toHaveBeenCalledWith("c1", []);
  });

  it("simular calcula y no escribe", async () => {
    const r = repos(pasos(10));
    const ronda = await new ResumenDeRecorridosService(r.repos, () => AHORA).correr({ simular: true });
    expect(ronda).toMatchObject({ tramos: 1, escritos: 0, simulado: true });
    expect(r.guardarRecorridos).not.toHaveBeenCalled();
  });
});
