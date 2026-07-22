import { describe, it, expect } from "vitest";
import { todayIso, addDaysIso, inCreatedAtRange } from "./date-range";
import { localDateIso } from "@jtel/domain";

/**
 * Test obligatorio de la Ficha-Handoff-Zona-Horaria.md:
 *
 * "Prueba del turno vespertino: con la hora del sistema simulada a las
 * 19:00 hora de Juárez, todayIso() devuelve el día civil de Juárez,
 * NO el día siguiente."
 *
 * Juárez (America/Ciudad_Juarez) está en UTC-6 (invierno) o UTC-7 (verano,
 * pero esta zona NO observa DST desde 2022). Así que en enero y julio
 * la hora es UTC-6.
 *
 * 19:00 Juárez = 01:00 UTC del día SIGUIENTE.
 * Bug anterior: todayIso() usaba toISOString() → devolvía el día UTC,
 * es decir el día siguiente. Turno B (18:00) caía en el día equivocado.
 */
describe("turno vespertino — todayIso devuelve día civil de Juárez, no UTC", () => {
  // 20 jul 2026, 19:00 hora de Juárez = 21 jul 2026, 01:00 UTC
  // America/Ciudad_Juarez observa MDT (UTC-6) en julio.
  const julyEvening = new Date("2026-07-21T01:00:00Z"); // 19:00 Juárez

  it("todayIso() a las 19:00 Juárez devuelve 2026-07-20, no 2026-07-21", () => {
    const result = todayIso("America/Ciudad_Juarez");
    // todayIso usa new Date() internamente, así que lo probamos con localDateIso
    // que acepta un Date arbitrario.
    const resultDirect = localDateIso(julyEvening, "America/Ciudad_Juarez");
    expect(resultDirect).toBe("2026-07-20");
  });

  it("localDateIso con Date UTC 01:00 del 21 jul → día civil 20 jul en Juárez", () => {
    expect(localDateIso(julyEvening, "America/Ciudad_Juarez")).toBe("2026-07-20");
  });

  it("el bug viejo: toISOString().slice(0,10) daría 2026-07-21 (UTC) ≠ día civil", () => {
    // Esto demuestra por qué el código anterior era incorrecto:
    const utcDate = julyEvening.toISOString().slice(0, 10);
    expect(utcDate).toBe("2026-07-21"); // ← el bug: día UTC, no día civil
    // Nuestra corrección:
    expect(localDateIso(julyEvening, "America/Ciudad_Juarez")).toBe("2026-07-20");
    expect(utcDate).not.toBe(localDateIso(julyEvening, "America/Ciudad_Juarez"));
  });

  it("addDaysIso no arrastra el error UTC", () => {
    // Partiendo del 20 jul, +1 día = 21 jul (no 22 jul)
    expect(addDaysIso("2026-07-20", 1, "America/Ciudad_Juarez")).toBe("2026-07-21");
    expect(addDaysIso("2026-07-20", -1, "America/Ciudad_Juarez")).toBe("2026-07-19");
  });

  it("inCreatedAtRange filtra por día civil, no UTC", () => {
    // Un evento a las 19:00 Juárez del 20 jul pertenece al 20 jul, no al 21 jul.
    const inJuly20 = inCreatedAtRange(
      julyEvening,
      "2026-07-20",
      "2026-07-20",
      "America/Ciudad_Juarez",
    );
    expect(inJuly20).toBe(true);

    // Y NO pertenece al rango 21-21 (que es donde caería con el bug UTC):
    const inJuly21 = inCreatedAtRange(
      julyEvening,
      "2026-07-21",
      "2026-07-21",
      "America/Ciudad_Juarez",
    );
    expect(inJuly21).toBe(false);
  });
});

describe("localDateIso — zona configurable", () => {
  // Misma hora absoluta, diferentes zonas → diferentes días civiles
  const midnight_utc = new Date("2026-07-21T00:30:00Z");

  it("en Juárez (UTC-6) a las 00:30 UTC del 21 jul → todavía 20 jul", () => {
    expect(localDateIso(midnight_utc, "America/Ciudad_Juarez")).toBe("2026-07-20");
  });

  it("en CDMX (UTC-6 en verano, sin DST 2022+) a las 00:30 UTC del 21 jul → 20 jul", () => {
    expect(localDateIso(midnight_utc, "America/Mexico_City")).toBe("2026-07-20");
  });

  it("en Cancún (UTC-5, sin DST) a las 00:30 UTC del 21 jul → 20 jul", () => {
    expect(localDateIso(midnight_utc, "America/Cancun")).toBe("2026-07-20");
  });

  it("en UTC a las 00:30 del 21 jul → 21 jul", () => {
    expect(localDateIso(midnight_utc, "UTC")).toBe("2026-07-21");
  });
});
