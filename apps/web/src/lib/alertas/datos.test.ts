/**
 * El camino del correo, probado donde nunca se había probado.
 *
 * El chequeo de verificación existía, la ruta `/api/salud` lo pedía, y el
 * resumen diario no — porque el correo armaba su propia muestra y nadie
 * comprobaba que la armara completa. El defecto vivió hasta que un humano leyó
 * el correo y vio "no se pudo contar".
 *
 * Estas pruebas son esa lectura, hecha por una máquina y todos los días: si
 * alguien vuelve a partir el armado en dos, o quita la consulta del conteo,
 * aquí se cae antes de que el correo salga mintiendo.
 *
 * Los repositorios son falsos a propósito y no tocan base: lo que se prueba es
 * QUÉ se pide y QUÉ llega al resumen, no cómo responde Postgres.
 */

import { describe, it, expect, vi } from "vitest";
import type { Repositories } from "@jtel/db";
import { armarResumen } from "./datos";
import type { ResumenDiario } from "./correo";

const AHORA = new Date("2026-08-16T13:00:00.000Z");
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000);

const repositorios = (
  conteo: { total: number; masAntiguoHoras: number | null } = { total: 0, masAntiguoHoras: null },
) => {
  const contarFallosMudos = vi.fn(async () => conteo);
  const repos = {
    accounts: {
      // Un carrier real y ningún cliente: sin clientes, `leerSinVeredicto` no
      // recorre ocurrencias y la prueba se queda en lo que le toca.
      listByType: vi.fn(async (tipo: string) => (tipo === "carrier" ? [{ id: "carrier-1" }] : [])),
    },
    telemetry: {
      listWatermarks: vi.fn(async () => [
        { carrierAccountId: "carrier-1", lastRecordedAt: haceMin(2), updatedAt: haceMin(1) },
      ]),
    },
    ingestAlerts: {
      listUnresolved: vi.fn(async () => []),
      listRecent: vi.fn(async () => []),
    },
    occurrences: { contarFallosMudos },
  } as unknown as Repositories;
  return { repos, contarFallosMudos };
};

const verificacion = (chequeos: ResumenDiario["chequeos"]) =>
  chequeos.find((c) => c.id === "verificacion");

describe("el resumen diario cuenta los servicios vencidos sin veredicto", () => {
  it("pide el conteo — no lo da por hecho ni lo hereda de la pantalla", async () => {
    const { repos, contarFallosMudos } = repositorios();

    await armarResumen(repos, AHORA);

    expect(contarFallosMudos).toHaveBeenCalledTimes(1);
  });

  it("el chequeo llega al correo como un número medido", async () => {
    const { repos } = repositorios();

    const r = await armarResumen(repos, AHORA);
    const ver = verificacion(r.chequeos);

    // La prueba que faltaba: `no_medido` aquí significa que el correo volvió a
    // salir sin poder contar, que es el defecto entero de C21.
    expect(ver?.estado).toBe("sano");
    expect(ver?.lectura).toContain("sin servicios vencidos sin veredicto");
    expect(r.saludAhora).toBe("sano");
  });

  it("cuando hay faltantes, el correo los reporta con su número y su antigüedad", async () => {
    const { repos } = repositorios({ total: 6, masAntiguoHoras: 49.8 });

    const r = await armarResumen(repos, AHORA);
    const ver = verificacion(r.chequeos);

    expect(ver?.estado).toBe("enfermo");
    expect(ver?.lectura).toContain("6 servicios");
    expect(ver?.lectura).toContain("49.8 h");
    expect(r.saludAhora).toBe("enfermo");
  });

  it("un cero medido y un cero por no medir no son el mismo resumen", async () => {
    const { repos } = repositorios();
    const medido = await armarResumen(repos, AHORA);

    expect(verificacion(medido.chequeos)?.estado).toBe("sano");
    expect(medido.diagnostico).not.toContain("no se pudo contar");
  });
});

/*
 * El conteo tiene que llegar al resumen COMO NÚMERO.
 *
 * Antes solo llegaba dentro de la prosa de `lectura`, y por eso el título no
 * tenía con qué contrastarse: afirmaba `sinVeredicto.total` a secas mientras
 * el renglón de abajo reportaba otra cifra de otra población. La única forma
 * de arreglarlo sin esto habría sido leer el número de vuelta de su propio
 * texto, que es como se construye el siguiente defecto.
 */
describe("la cola de verificación viaja como número, no como prosa", () => {
  it("el conteo medido llega al resumen y no solo dentro de la frase", async () => {
    const { repos } = repositorios({ total: 6, masAntiguoHoras: 49.8 });

    const r = await armarResumen(repos, AHORA);

    expect(r.colaVerificacion).toEqual({ total: 6 });
  });

  it("un cero medido llega como cero, no como ausencia", async () => {
    const { repos } = repositorios();

    const r = await armarResumen(repos, AHORA);

    // `null` significaría "no se pudo medir", y aquí SÍ se midió. Confundir
    // los dos es el defecto que el PR 2 de C21 existió para cerrar.
    expect(r.colaVerificacion).toEqual({ total: 0 });
  });

  it("el número del título y el estado del renglón no pueden divergir", async () => {
    const { repos } = repositorios({ total: 6, masAntiguoHoras: 49.8 });

    const r = await armarResumen(repos, AHORA);

    // Se lee del chequeo, no se supone: si el renglón dice "no medido", el
    // título no tiene número que decir, y al revés.
    expect(verificacion(r.chequeos)?.estado).not.toBe("no_medido");
    expect(r.colaVerificacion).not.toBeNull();
  });
});
