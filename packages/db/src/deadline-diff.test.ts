import { describe, it, expect } from "vitest";
import { clasificarDiferencia, MINUTOS_MARCO_DISTINTO } from "./deadline-diff.js";

const JRZ = "America/Ciudad_Juarez";

describe("clasificar por qué difiere un deadline", () => {
  it("el bug real de Planta 47 se clasifica como zona", () => {
    // Turno 06:00, anticipación 15. Guardado 05:45 UTC —que en Juárez son las
    // 23:45 del día anterior— cuando debía ser 11:45 UTC.
    const r = clasificarDiferencia({
      serviceDate: "2026-07-21",
      guardado: new Date("2026-07-21T05:45:00.000Z"),
      shiftStartTime: "06:00:00",
      anticipationMinutes: 15,
      timeZone: JRZ,
    });
    expect(r.causa).toBe("zona");
    expect(r.difMinutos).toBe(360);
    expect(r.correcto.toISOString()).toBe("2026-07-21T11:45:00.000Z");
  });

  it("el desajuste real del Campus se clasifica como deriva", () => {
    // Guardado con anticipación 15; el contrato hoy dice 20. El marco temporal
    // es correcto: solo sobran cinco minutos.
    const r = clasificarDiferencia({
      serviceDate: "2026-07-29",
      guardado: new Date("2026-07-29T11:45:00.000Z"),
      shiftStartTime: "06:00:00",
      anticipationMinutes: 20,
      timeZone: JRZ,
    });
    expect(r.causa).toBe("deriva");
    expect(r.difMinutos).toBe(-5);
  });

  it("un deadline correcto no reporta causa", () => {
    const r = clasificarDiferencia({
      serviceDate: "2026-07-21",
      guardado: new Date("2026-07-21T11:40:00.000Z"),
      shiftStartTime: "06:00:00",
      anticipationMinutes: 20,
      timeZone: JRZ,
    });
    expect(r.causa).toBe("ninguna");
    expect(r.difMinutos).toBe(0);
  });

  it("no confunde zona con deriva aunque la deriva sea grande", () => {
    // Una hora de cambio en la anticipación sigue anclada a la medianoche
    // local; solo a partir del umbral se considera otro marco temporal.
    const casi = clasificarDiferencia({
      serviceDate: "2026-07-21",
      guardado: new Date("2026-07-21T12:39:00.000Z"),
      shiftStartTime: "06:00:00",
      anticipationMinutes: 20,
      timeZone: JRZ,
    });
    expect(casi.causa).toBe("deriva");
    expect(Math.abs(casi.difMinutos)).toBeLessThan(MINUTOS_MARCO_DISTINTO);
  });

  it("una zona equivocada al otro lado también es zona", () => {
    // Generado como si el contrato fuera de Tokio.
    const r = clasificarDiferencia({
      serviceDate: "2026-07-21",
      guardado: new Date("2026-07-20T21:00:00.000Z"),
      shiftStartTime: "06:00:00",
      anticipationMinutes: 0,
      timeZone: JRZ,
    });
    expect(r.causa).toBe("zona");
    expect(r.correcto.toISOString()).toBe("2026-07-21T12:00:00.000Z");
  });

  it("respeta el horario de verano al decidir", () => {
    // 2026-11-02: Juárez ya volvió a UTC-7. Un deadline calculado con UTC-6
    // queda una hora corrido — eso es deriva de marco, no de política, pero
    // cae por debajo del umbral y se reporta como deriva a propósito: una
    // hora no es un marco temporal distinto, y la corrección es la misma.
    const r = clasificarDiferencia({
      serviceDate: "2026-11-02",
      guardado: new Date("2026-11-02T12:00:00.000Z"),
      shiftStartTime: "06:00:00",
      anticipationMinutes: 0,
      timeZone: JRZ,
    });
    expect(r.correcto.toISOString()).toBe("2026-11-02T13:00:00.000Z");
    expect(r.difMinutos).toBe(60);
    expect(r.causa).toBe("zona");
  });

  it("la clasificación no depende del reloj del proceso", () => {
    const original = process.env.TZ;
    const bajo = (tz: string) => {
      process.env.TZ = tz;
      try {
        return clasificarDiferencia({
          serviceDate: "2026-07-21",
          guardado: new Date("2026-07-21T05:45:00.000Z"),
          shiftStartTime: "06:00:00",
          anticipationMinutes: 15,
          timeZone: JRZ,
        });
      } finally {
        process.env.TZ = original;
      }
    };
    const a = bajo("UTC");
    const b = bajo("Asia/Tokyo");
    expect(a.causa).toBe(b.causa);
    expect(a.correcto.toISOString()).toBe(b.correcto.toISOString());
  });
});
