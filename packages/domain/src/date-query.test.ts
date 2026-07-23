import { describe, it, expect } from "vitest";
import { dayForDateQuery, localDateIso, JTTEL_TZ, civilDatesInRange } from "./index.js";

/**
 * Suite de regresión para `dayForDateQuery`.
 *
 * El script de test fuerza TZ=UTC (ver package.json) para simular el runtime
 * de Vercel. El bug original usaba `new Date(`${fecha}T00:00:00`)` sin Z:
 * en UTC eso es medianoche UTC = 18:00 del día anterior en Juárez → el
 * filtro de ocurrencias retornaba 0 rutas para el día pedido.
 */
describe("dayForDateQuery — runtime UTC (simula Vercel)", () => {
  it("fecha en verano (MDT, UTC-6): mismo día civil en Juárez", () => {
    // Mediodía UTC = 06:00 Juárez en horario de verano (MDT, UTC-6).
    expect(localDateIso(dayForDateQuery("2026-07-22"), JTTEL_TZ)).toBe("2026-07-22");
  });

  it("fecha en invierno (MST, UTC-7): mismo día civil en Juárez", () => {
    // Mediodía UTC = 05:00 Juárez en horario estándar (MST, UTC-7).
    expect(localDateIso(dayForDateQuery("2026-01-15"), JTTEL_TZ)).toBe("2026-01-15");
  });

  it("produce instante UTC fijo (T12:00:00.000Z), independiente de TZ local", () => {
    expect(dayForDateQuery("2026-07-22").toISOString()).toBe("2026-07-22T12:00:00.000Z");
  });
});

describe("calendar loop — DOW/serviceDate (TZ=UTC simula Vercel)", () => {
  /**
   * Regresión para el bucle de generateForProfile.
   *
   * Mecanismo del bug: `startOfDay` devuelve medianoche UTC. En verano (MDT,
   * UTC-6), medianoche UTC = 18:00 Juárez del día ANTERIOR. Por tanto
   * `localDateIso(midnightUTC, JTTEL_TZ)` devuelve el día civil previo,
   * mientras `midnightUTC.getDay()` devuelve el DOW UTC del día actual.
   * Los dos calendarios están corridos un día.
   *
   * Arreglo: iterar sobre strings de fecha civil. DOW = `.getUTCDay()` sobre
   * mediodía UTC del mismo string. `serviceDate` = el mismo string.
   * Mismo calendario, sin conversión Date → Juárez en el bucle.
   *
   * Prueba del bug: FALLA con código roto (expect "2026-08-24", recibe "2026-08-23").
   * Prueba del arreglo: PASA en todo entorno donde TZ=UTC.
   */

  it("bug: medianoche UTC lun-24 → localDateIso = dom-23 (mecanismo del corrimiento)", () => {
    // medianoche UTC del lunes 24 ago 2026 = 18:00 del domingo 23 en Juárez (MDT, UTC-6)
    const midnightMon = new Date("2026-08-24T00:00:00.000Z");
    expect(midnightMon.getDay()).toBe(1);                          // DOW=lunes (UTC) ← correcto
    expect(localDateIso(midnightMon, JTTEL_TZ)).toBe("2026-08-23"); // serviceDate=domingo ← BUG
  });

  it("arreglo: bucle sobre strings civiles, rango sáb-22 a lun-24, solo genera lun-24", () => {
    // Simulación exacta del bucle arreglado en generateForProfile.
    const activeDays = [1, 2, 3, 4, 5]; // L-V
    const generated: string[] = [];

    let currentIso = "2026-08-22"; // sábado
    const endIso = "2026-08-24";   // lunes
    while (currentIso <= endIso) {
      const dow = new Date(`${currentIso}T12:00:00.000Z`).getUTCDay();
      if (activeDays.includes(dow)) generated.push(currentIso);
      const d = new Date(`${currentIso}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      currentIso = d.toISOString().slice(0, 10);
    }

    expect(generated).toEqual(["2026-08-24"]); // solo lunes ✓
    expect(generated).not.toContain("2026-08-23"); // domingo nunca se genera ✓
  });

  it("civilDatesInRange: rango sáb-22 a lun-24, L-V → solo lun-24 (guarda de regresión)", () => {
    // FALLA con implementación rota (localDateIso sobre midnight UTC → dom-23).
    // PASA con implementación correcta (noon UTC → lun-24).
    expect(civilDatesInRange("2026-08-22", "2026-08-24", [1, 2, 3, 4, 5])).toEqual([
      "2026-08-24",
    ]);
  });

  it("civilDatesInRange: rango vie-21 a lun-24, L-V → [vie-21, lun-24]", () => {
    expect(civilDatesInRange("2026-08-21", "2026-08-24", [1, 2, 3, 4, 5])).toEqual([
      "2026-08-21",
      "2026-08-24",
    ]);
  });

  it("arreglo: bucle viernes-21 a lunes-24, genera vie-21 y lun-24, omite sáb/dom", () => {
    const activeDays = [1, 2, 3, 4, 5];
    const generated: string[] = [];

    let currentIso = "2026-08-21"; // viernes
    const endIso = "2026-08-24";   // lunes
    while (currentIso <= endIso) {
      const dow = new Date(`${currentIso}T12:00:00.000Z`).getUTCDay();
      if (activeDays.includes(dow)) generated.push(currentIso);
      const d = new Date(`${currentIso}T12:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      currentIso = d.toISOString().slice(0, 10);
    }

    expect(generated).toContain("2026-08-21");      // viernes ✓
    expect(generated).toContain("2026-08-24");      // lunes ✓
    expect(generated).not.toContain("2026-08-22");  // sábado ✗
    expect(generated).not.toContain("2026-08-23");  // domingo ✗
  });
});
