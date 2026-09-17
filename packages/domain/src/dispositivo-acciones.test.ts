import { describe, expect, it } from "vitest";
import {
  MOTIVO_MAX,
  esPrefijoDeModelo,
  motivoCapturado,
  nombreDeDispositivo,
  procedeAsignar,
  procedeBaja,
  procedeSoltar,
} from "./dispositivo-acciones.js";

describe("nombreDeDispositivo (Marco 6.3)", () => {
  it("marca + modelo + consecutivo a tres cifras", () => {
    expect(nombreDeDispositivo("TK-FTC927", 9)).toBe("TK-FTC927-009");
    expect(nombreDeDispositivo("TK-FTC927", 80)).toBe("TK-FTC927-080");
  });

  it("pasado el 999 no trunca: un nombre truncado sería el de otro dispositivo", () => {
    expect(nombreDeDispositivo("TK-FTC927", 1000)).toBe("TK-FTC927-1000");
  });

  it("un consecutivo que no es entero positivo no se escribe", () => {
    expect(() => nombreDeDispositivo("TK-FTC927", 0)).toThrow();
    expect(() => nombreDeDispositivo("TK-FTC927", 1.5)).toThrow();
  });

  it("sólo se nombran los modelos que la plataforma conoce", () => {
    expect(esPrefijoDeModelo("TK-FTC927")).toBe(true);
    expect(esPrefijoDeModelo("TK-FMB920")).toBe(false);
  });
});

describe("motivoCapturado", () => {
  it("limpia espacios y lo deja en una línea", () => {
    expect(motivoCapturado("  se   quemó\n en taller ")).toEqual({ ok: true, motivo: "se quemó en taller" });
  });

  it("vacío o sólo espacios no es motivo", () => {
    expect(motivoCapturado("   ")).toEqual({ ok: false, error: "motivo_vacio" });
    expect(motivoCapturado(null)).toEqual({ ok: false, error: "motivo_vacio" });
  });

  it("uno que no cabe se rechaza, no se corta", () => {
    expect(motivoCapturado("a".repeat(MOTIVO_MAX + 1))).toEqual({ ok: false, error: "motivo_largo" });
    expect(motivoCapturado("a".repeat(MOTIVO_MAX)).ok).toBe(true);
  });
});

describe("cuándo procede cada acción", () => {
  const enBodega = { retiredAt: null, unidadVigenteId: null };
  const montado = { retiredAt: null, unidadVigenteId: "u1" };
  const deBaja = { retiredAt: new Date("2026-09-15T00:00:00Z"), unidadVigenteId: null };
  const activa = { id: "u2", active: true };

  it("asignar: de bodega a una unidad activa, sí", () => {
    expect(procedeAsignar(enBodega, activa)).toEqual({ ok: true });
  });

  it("asignar: de una unidad a otra, sí — la asignación vieja se cierra al escribir", () => {
    expect(procedeAsignar(montado, activa)).toEqual({ ok: true });
  });

  it("asignar: un dispositivo de baja no se ofrece (6.5)", () => {
    expect(procedeAsignar(deBaja, activa)).toEqual({ ok: false, error: "dispositivo_de_baja" });
  });

  it("asignar: una unidad inactiva no recibe dispositivo", () => {
    expect(procedeAsignar(enBodega, { id: "u2", active: false })).toEqual({ ok: false, error: "unidad_inactiva" });
  });

  it("asignar donde ya está no parte su historia en dos", () => {
    expect(procedeAsignar(montado, { id: "u1", active: true })).toEqual({ ok: false, error: "ya_asignado_ahi" });
  });

  it("soltar: sólo lo montado", () => {
    expect(procedeSoltar(montado)).toEqual({ ok: true });
    expect(procedeSoltar(enBodega)).toEqual({ ok: false, error: "no_esta_montado" });
  });

  it("baja: montado o en bodega sí; dos veces no", () => {
    expect(procedeBaja(montado)).toEqual({ ok: true });
    expect(procedeBaja(enBodega)).toEqual({ ok: true });
    expect(procedeBaja(deBaja)).toEqual({ ok: false, error: "ya_de_baja" });
  });
});
