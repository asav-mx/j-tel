import { describe, expect, it } from "vitest";
import { instanteDeCampoLocal, situacionDelAviso, validarAviso } from "./avisos.js";
import { slugReservado } from "./slugs-reservados.js";

const AHORA = new Date("2026-09-22T12:00:00Z");
const en = (min: number) => new Date(AHORA.getTime() + min * 60_000);

describe("validarAviso", () => {
  it("un aviso normal pasa, con «desde» = ahora si no se dice", () => {
    const r = validarAviso({ titulo: "  La ruta va por Av. de la Raza  ", detalle: "Mientras dure la obra." }, AHORA);
    expect(r).toEqual({
      ok: true,
      aviso: { titulo: "La ruta va por Av. de la Raza", detalle: "Mientras dure la obra.", vigenteDesde: AHORA, vigenteHasta: null },
    });
  });

  it("sin título, o con título o detalle de más, no", () => {
    expect(validarAviso({ titulo: "   " }, AHORA).ok).toBe(false);
    expect(validarAviso({ titulo: "a".repeat(81) }, AHORA).ok).toBe(false);
    expect(validarAviso({ titulo: "Obra", detalle: "x".repeat(281) }, AHORA).ok).toBe(false);
  });

  it("nunca un letrero de alarma: un título todo en mayúsculas se rechaza, con la razón", () => {
    const r = validarAviso({ titulo: "¡¡SE SUSPENDE EL SERVICIO!!" }, AHORA);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/mayúsculas/) });
    // Siglas dentro de una frase normal sí pasan.
    expect(validarAviso({ titulo: "La UACJ cierra la calle Charro" }, AHORA).ok).toBe(true);
  });

  it("«hasta» después de «desde», y no en el pasado", () => {
    expect(validarAviso({ titulo: "Obra", desde: en(60), hasta: en(30) }, AHORA).ok).toBe(false);
    expect(validarAviso({ titulo: "Obra", desde: en(-120), hasta: en(-60) }, AHORA).ok).toBe(false);
    expect(validarAviso({ titulo: "Obra", desde: en(60), hasta: en(120) }, AHORA).ok).toBe(true);
  });
});

describe("situacionDelAviso", () => {
  const a = (o: Partial<{ vigenteDesde: Date; vigenteHasta: Date | null; retiradoEn: Date | null }>) => ({
    vigenteDesde: en(-10), vigenteHasta: null, retiradoEn: null, ...o,
  });
  it("en Ontoy, programado, terminó o retirado", () => {
    expect(situacionDelAviso(a({}), AHORA)).toBe("en_ontoy");
    expect(situacionDelAviso(a({ vigenteDesde: en(30) }), AHORA)).toBe("programado");
    expect(situacionDelAviso(a({ vigenteHasta: en(-1) }), AHORA)).toBe("termino");
    expect(situacionDelAviso(a({ retiradoEn: en(-5) }), AHORA)).toBe("retirado");
  });
});

describe("slugs reservados", () => {
  it("en-vivo y paradas-de-la-ciudad no pueden ser el slug de un circuito", () => {
    expect(slugReservado("en-vivo")).toBe(true);
    expect(slugReservado(" Paradas-de-la-Ciudad ")).toBe(true);
    expect(slugReservado("zaragoza-centro")).toBe(false);
  });
});

describe("instanteDeCampoLocal", () => {
  it("lee la hora del formulario en la zona del circuito, no en la del servidor", () => {
    // Juárez en septiembre es UTC−6.
    expect(instanteDeCampoLocal("2026-09-22T14:30", "America/Ciudad_Juarez")?.toISOString()).toBe("2026-09-22T20:30:00.000Z");
  });
  it("vacío o mal escrito, null", () => {
    expect(instanteDeCampoLocal("", "America/Ciudad_Juarez")).toBeNull();
    expect(instanteDeCampoLocal("mañana", "America/Ciudad_Juarez")).toBeNull();
  });
});
