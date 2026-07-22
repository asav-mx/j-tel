import { describe, it, expect } from "vitest";
import { dayForDateQuery, localDateIso, JTTEL_TZ } from "./index.js";

/**
 * Suite de regresión para `dayForDateQuery`.
 *
 * El script de test fuerza TZ=UTC (ver package.json) para simular el runtime
 * de Vercel. El bug original usaba `new Date(`${fecha}T00:00:00`)` sin Z:
 * en UTC eso es medianoche UTC = 18:00 del día anterior en Juárez → el
 * filtro de ocurrencias retornaba 0 rutas para el día pedido.
 */
describe("dayForDateQuery — runtime UTC (simula Vercel)", () => {
  it("fecha en verano (UTC-6): mismo día civil en Juárez", () => {
    // Mediodía UTC = 06:00 Juárez en horario de verano (CDT, UTC-6).
    expect(localDateIso(dayForDateQuery("2026-07-22"), JTTEL_TZ)).toBe("2026-07-22");
  });

  it("fecha en invierno (UTC-7): mismo día civil en Juárez", () => {
    // Mediodía UTC = 05:00 Juárez en horario estándar (CST, UTC-7).
    expect(localDateIso(dayForDateQuery("2026-01-15"), JTTEL_TZ)).toBe("2026-01-15");
  });

  it("produce instante UTC fijo (T12:00:00.000Z), independiente de TZ local", () => {
    expect(dayForDateQuery("2026-07-22").toISOString()).toBe("2026-07-22T12:00:00.000Z");
  });
});
