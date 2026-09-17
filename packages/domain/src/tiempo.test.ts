import { describe, expect, it } from "vitest";
import { instanteZonificado, JTTEL_TZ, ventanaDelDia } from "./tiempo.js";

describe("ventanaDelDia · el día como caso de ventana", () => {
  it("va de la medianoche civil al último milisegundo del mismo día, en la zona", () => {
    const v = ventanaDelDia("2026-09-14", "America/Ciudad_Juarez");
    expect(v.desde.toISOString()).toBe("2026-09-14T06:00:00.000Z");
    expect(v.hasta.toISOString()).toBe("2026-09-15T05:59:59.999Z");
  });

  it("sin zona usa la del despliegue", () => {
    expect(ventanaDelDia("2026-09-14")).toEqual(ventanaDelDia("2026-09-14", JTTEL_TZ));
  });

  it("dos días seguidos no se enciman ni dejan hueco entre ellos", () => {
    const hoy = ventanaDelDia("2026-09-14");
    const manana = ventanaDelDia("2026-09-15");
    expect(manana.desde.getTime() - hoy.hasta.getTime()).toBe(1);
    expect(manana.desde).toEqual(instanteZonificado("2026-09-15", 0));
  });

  it("el día del cambio de horario dura lo que dura, no 24 h fijas", () => {
    // 1 nov 2026: Juárez regresa de UTC-6 a UTC-7; ese día civil tiene 25 horas.
    const v = ventanaDelDia("2026-11-01", "America/Ciudad_Juarez");
    expect(v.hasta.getTime() + 1 - v.desde.getTime()).toBe(25 * 60 * 60_000);
  });
});
