import { describe, it, expect } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  MAX_PARAMETROS_POR_SENTENCIA,
  filasPorSentencia,
  enLotes,
  escribirEnLotes,
} from "./lote-de-escritura.js";
import { evidencePoints, telemetryPoints, serviceOccurrences } from "./schema/index.js";

describe("enLotes", () => {
  it("no parte lo que ya cabe", () => {
    expect(enLotes([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("parte en tandas del tamaño pedido y deja el resto al final", () => {
    expect(enLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("no devuelve tandas vacías", () => {
    expect(enLotes([], 3)).toEqual([]);
    expect(enLotes([1, 2, 3, 4], 2).every((l) => l.length > 0)).toBe(true);
  });

  it("un tamaño absurdo no cuelga el proceso", () => {
    expect(enLotes([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
    expect(enLotes([1, 2, 3], -5)).toEqual([[1], [2], [3]]);
  });
});

describe("filasPorSentencia", () => {
  it("ninguna tabla real se pasa del techo de parámetros", () => {
    // La valla: filas × columnas ≤ el techo. Si alguien agrega una columna a
    // estas tablas, el lote se encoge solo y esto sigue en verde.
    //
    // Las columnas se cuentan con `getTableColumns` y no con `Object.keys` de
    // la tabla: el objeto de drizzle trae claves que no son columnas, y contar
    // de más aquí escondería que la cuenta real sea otra.
    for (const tabla of [evidencePoints, telemetryPoints, serviceOccurrences]) {
      const columnas = Object.keys(getTableColumns(tabla)).length;
      const filas = filasPorSentencia(tabla);
      expect(filas).toBeGreaterThan(0);
      expect(filas * columnas).toBeLessThanOrEqual(MAX_PARAMETROS_POR_SENTENCIA);
    }
  });

  it("cuenta las columnas que la tabla declara de verdad", () => {
    // Ancla contra el esquema: si esto cambia sin querer, el lote cambia con él.
    expect(Object.keys(getTableColumns(evidencePoints))).toEqual([
      "id", "tripId", "deviceId", "unitId",
      "imei", "latitude", "longitude", "speed", "recordedAt",
    ]);
  });

  it("los puntos de evidencia caben en tandas menores a las 8 192 que reventaron", () => {
    // 8 192 filas × 8 columnas = 65 536 parámetros fue el número exacto que
    // Postgres rechazó el 2026-08-03. El lote tiene que quedar por debajo.
    expect(filasPorSentencia(evidencePoints)).toBeLessThan(8192);
  });
});

describe("escribirEnLotes", () => {
  it("llama al escritor una vez por tanda y concatena el resultado", async () => {
    const tandas: number[][] = [];
    const salida = await escribirEnLotes([1, 2, 3, 4, 5], 2, async (lote) => {
      tandas.push(lote);
      return lote.map((n) => n * 10);
    });
    expect(tandas).toEqual([[1, 2], [3, 4], [5]]);
    expect(salida).toEqual([10, 20, 30, 40, 50]);
  });

  it("con nada que escribir no toca la base", async () => {
    let llamadas = 0;
    const salida = await escribirEnLotes([], 100, async () => {
      llamadas++;
      return [];
    });
    expect(llamadas).toBe(0);
    expect(salida).toEqual([]);
  });

  it("una tanda de 12 000 puntos se parte en vez de irse entera", async () => {
    // El caso que dejó ocho servicios 35 días sin veredicto.
    const puntos = Array.from({ length: 12_000 }, (_, i) => i);
    const tamanos: number[] = [];
    await escribirEnLotes(puntos, filasPorSentencia(evidencePoints), async (lote) => {
      tamanos.push(lote.length);
      return lote;
    });
    expect(tamanos.length).toBeGreaterThan(1);
    expect(Math.max(...tamanos)).toBeLessThan(8192);
    expect(tamanos.reduce((a, b) => a + b, 0)).toBe(12_000);
  });
});
