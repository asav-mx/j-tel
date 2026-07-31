import { describe, it, expect } from "vitest";
import { resolverPeriodo, hhMm, minutosDeHhMm, MAX_DIAS } from "./historial-periodo";

/** La franja, en minutos, tal como se la va a pedir a la base de datos. */
function minutosDeVentana(p: { desde: Date; hasta: Date }): number {
  return (p.hasta.getTime() - p.desde.getTime()) / 60_000;
}

describe("la franja del día completo dura un día", () => {
  it("00:00 a 00:00 son 24 h, no cero", () => {
    // La regresión: tratar el día completo como "no envuelve" dejaba la
    // ventana en cero y la pantalla afirmaba que la flota no reportó nada.
    const p = resolverPeriodo({ fecha: "2026-07-22", horaDesde: "00:00", horaHasta: "00:00" });
    expect(minutosDeVentana(p)).toBe(24 * 60);
  });

  it("y no le dice al usuario que cierra al día siguiente", () => {
    const p = resolverPeriodo({ fecha: "2026-07-22", horaDesde: "00:00", horaHasta: "00:00" });
    expect(p.cruzaMedianoche).toBe(false);
  });

  it("un turno de noche sí envuelve, y sí se le dice", () => {
    const p = resolverPeriodo({ fecha: "2026-07-22", horaDesde: "22:00", horaHasta: "06:00" });
    expect(minutosDeVentana(p)).toBe(8 * 60);
    expect(p.cruzaMedianoche).toBe(true);
  });

  it("una franja normal no envuelve", () => {
    const p = resolverPeriodo({ fecha: "2026-07-22", horaDesde: "05:00", horaHasta: "11:00" });
    expect(minutosDeVentana(p)).toBe(6 * 60);
    expect(p.cruzaMedianoche).toBe(false);
  });
});

describe("el rango de días", () => {
  it("trae un día por fecha, del más reciente al más antiguo", () => {
    const p = resolverPeriodo({ desde: "2026-07-20", hasta: "2026-07-22" });
    expect(p.fechas).toEqual(["2026-07-22", "2026-07-21", "2026-07-20"]);
    expect(p.fechaDesde).toBe("2026-07-20");
    expect(p.fechaHasta).toBe("2026-07-22");
  });

  it("un rango al revés se endereza en vez de quedar vacío", () => {
    const p = resolverPeriodo({ desde: "2026-07-22", hasta: "2026-07-20" });
    expect(p.fechas).toEqual(["2026-07-20"]);
    expect(p.diasPedidos).toBe(1);
  });

  it("recorta al tope y deja dicho cuánto recortó — nunca en silencio", () => {
    // El rango pedido tiene que EXCEDER el tope para que esto pruebe algo. Con
    // uno de exactamente MAX_DIAS la prueba pasaría verde sin ejercer el
    // recorte, que es justo lo que viene a cuidar.
    const p = resolverPeriodo({ desde: "2026-05-01", hasta: "2026-07-31" });
    expect(p.fechas).toHaveLength(MAX_DIAS);
    expect(p.diasPedidos).toBe(92);
    expect(p.diasRecortados).toBe(92 - MAX_DIAS);
    // Se conservan los más recientes: lo último que hizo la unidad es lo
    // primero que el carrier necesita ver.
    expect(p.fechas[0]).toBe("2026-07-31");
  });

  it("un mes exacto pasa entero, sin recorte", () => {
    const p = resolverPeriodo({ desde: "2026-07-01", hasta: "2026-07-31" });
    expect(p.fechas).toHaveLength(31);
    expect(p.diasRecortados).toBe(0);
  });

  it("respeta un tope más chico cuando la vista lo pide", () => {
    const p = resolverPeriodo({ desde: "2026-07-20", hasta: "2026-07-22" }, { maxDias: 1 });
    expect(p.fechas).toEqual(["2026-07-22"]);
    expect(p.diasRecortados).toBe(2);
  });

  it("`fecha` sola vale por los dos extremos", () => {
    const p = resolverPeriodo({ fecha: "2026-07-22" });
    expect(p.fechas).toEqual(["2026-07-22"]);
  });

  it("la franja horaria se aplica dentro de CADA día del rango", () => {
    const p = resolverPeriodo({
      desde: "2026-07-20",
      hasta: "2026-07-22",
      horaDesde: "05:00",
      horaHasta: "11:00",
    });
    // Del 20 a las 05:00 al 22 a las 11:00: dos días completos más seis horas.
    expect(minutosDeVentana(p)).toBe(2 * 24 * 60 + 6 * 60);
    expect(p.minutosDesde).toBe(300);
    expect(p.minutosHasta).toBe(660);
  });
});

describe("entradas torcidas no tumban la pantalla", () => {
  it("una fecha inválida cae al día de hoy", () => {
    const p = resolverPeriodo({ fecha: "22-07-2026" });
    expect(p.fechas).toHaveLength(1);
    expect(p.fechas[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("una hora inválida cae al valor por defecto", () => {
    expect(minutosDeHhMm("25:00", 300)).toBe(300);
    expect(minutosDeHhMm("07:61", 300)).toBe(300);
    expect(minutosDeHhMm(undefined, 300)).toBe(300);
    expect(minutosDeHhMm(["05:00"], 300)).toBe(300);
    expect(minutosDeHhMm("05:00", 300)).toBe(300);
    expect(minutosDeHhMm("06:30", 0)).toBe(390);
  });

  it("hhMm y minutosDeHhMm son inversas", () => {
    for (const minutos of [0, 300, 660, 1320, 1439]) {
      expect(minutosDeHhMm(hhMm(minutos), -1)).toBe(minutos);
    }
  });
});
