import { describe, it, expect } from "vitest";
import { GRUPOS_DE_LECTOR, cuartoDeLectores, grupoDe } from "./cuarto-lectores.js";
import type { Repositories } from "@jtel/db";

/**
 * El cuarto Lectores, con la base de mentira. Lo que se prueba aquí es **a qué
 * grupo cae cada lector**, que es lo único que este módulo decide: el resto lo
 * decide el dominio (si está mudo) o la base (qué filas hay).
 */

const HORARIO = { inicioLocal: "05:00", finLocal: "23:00", zona: "America/Ciudad_Juarez" };
const AHORA = new Date("2026-09-23T18:00:00.000Z"); // 12:00 en Juárez

function fila(extra: Record<string, unknown> = {}) {
  return {
    id: "lec-1",
    label: "LEC-001",
    llavePublica: "a".repeat(58) + "9f3c1d",
    carrierAccountId: "cuenta-1",
    carrier: "Transportes de ciudad",
    altaEn: new Date("2026-09-01T12:00:00.000Z"),
    bajaEn: null,
    bajaMotivo: null,
    unitId: "u-1",
    unidad: "2120",
    circuitId: "c-1",
    circuito: "Zaragoza–Centro",
    inicioLocal: HORARIO.inicioLocal,
    finLocal: HORARIO.finLocal,
    zona: HORARIO.zona,
    ultimaEntrega: new Date("2026-09-23T17:50:00.000Z"),
    ...extra,
  };
}

const reposCon = (filas: ReturnType<typeof fila>[]) =>
  ({ libroDeBoletos: { inventarioDeLectores: async () => filas } }) as unknown as Parameters<
    typeof cuartoDeLectores
  >[0];

describe("a qué grupo cae un lector", () => {
  it("montado y hablando: en unidad", () => {
    expect(grupoDe({ bajaEn: null, unitId: "u-1", salud: { estado: "en_contacto", horasDeServicioSinContacto: 0.2 } })).toBe("en_unidad");
  });

  it("sin unidad: en bodega, aunque lleve semanas callado", () => {
    expect(grupoDe({ bajaEn: null, unitId: null, salud: { estado: "mudo", horasDeServicioSinContacto: 99 } })).toBe("en_bodega");
  });

  /* Mudo gana sobre en unidad: es el que pide ir a ver el camión. */
  it("montado y mudo: mudo, no en unidad", () => {
    expect(grupoDe({ bajaEn: null, unitId: "u-1", salud: { estado: "mudo", horasDeServicioSinContacto: 5 } })).toBe("mudo");
  });

  it("de baja gana sobre todo lo demás", () => {
    expect(grupoDe({ bajaEn: new Date(), unitId: "u-1", salud: { estado: "mudo", horasDeServicioSinContacto: 9 } })).toBe("de_baja");
  });

  it("los cuatro grupos existen aunque estén vacíos", async () => {
    const cuarto = await cuartoDeLectores(reposCon([]), AHORA);
    expect(Object.keys(cuarto.grupos).sort()).toEqual([...GRUPOS_DE_LECTOR].sort());
    expect(cuarto.total).toBe(0);
  });
});

describe("lo que el cuarto arma de cada lector", () => {
  it("la huella son los últimos seis de su llave", async () => {
    const cuarto = await cuartoDeLectores(reposCon([fila()]), AHORA);
    expect(cuarto.grupos.en_unidad[0]!.huella).toBe("9f3c1d");
  });

  /* Sin circuito no hay horario, y sin horario no se puede contar el silencio.
     No se inventa una jornada: se dice que no se puede decir. */
  it("un lector cuya unidad no tiene circuito no se juzga", async () => {
    const sinCircuito = fila({ circuitId: null, circuito: null, inicioLocal: null, finLocal: null, zona: null });
    const cuarto = await cuartoDeLectores(reposCon([sinCircuito]), AHORA);
    const lector = cuarto.grupos.en_unidad[0]!;
    expect(lector.salud).toEqual({ estado: "no_se_puede_decir", motivo: "sin_circuito_asignado" });
    expect(lector.circuito).toBeNull();
  });

  /* Recién dado de alta y sin entregar nada: el silencio se cuenta desde el
     alta, no desde el principio de los tiempos. */
  it("sin entregas, el silencio se cuenta desde el alta", async () => {
    const reciente = fila({ ultimaEntrega: null, altaEn: new Date("2026-09-23T17:30:00.000Z") });
    const cuarto = await cuartoDeLectores(reposCon([reciente]), AHORA);
    expect(cuarto.grupos.en_unidad[0]!.salud.estado).toBe("en_contacto");
    expect(cuarto.grupos.en_unidad[0]!.ultimoContacto).toBeNull();
  });

  it("con más de 4 h de servicio callado, cae en mudo", async () => {
    const callado = fila({ ultimaEntrega: new Date("2026-09-23T12:00:00.000Z") }); // 06:00 en Juárez
    const cuarto = await cuartoDeLectores(reposCon([callado]), AHORA);
    expect(cuarto.grupos.mudo).toHaveLength(1);
    expect(cuarto.grupos.en_unidad).toHaveLength(0);
  });

  it("cuenta los que están en servicio sin contar los de baja", async () => {
    const cuarto = await cuartoDeLectores(
      reposCon([fila(), fila({ id: "lec-2", bajaEn: new Date(), bajaMotivo: "Se perdió" })]),
      AHORA,
    );
    expect(cuarto.total).toBe(2);
    expect(cuarto.enServicio).toBe(1);
    expect(cuarto.grupos.de_baja[0]!.bajaMotivo).toBe("Se perdió");
  });
});
