import { describe, expect, it } from "vitest";
import { digitoVerificadorCuadra, normalizarImei, validarImei } from "./imei.js";

/** Los cuatro FTC927 reales de Compás, 14 de septiembre de 2026. */
const REALES = ["860693082402380", "860573080597409", "860693089187232", "860693086784395"];

describe("el dígito verificador del IMEI", () => {
  it("los cuatro IMEI reales de Compás lo pasan", () => {
    for (const imei of REALES) expect(validarImei(imei)).toEqual({ ok: true, imei });
  });

  /**
   * La razón de existir de todo el archivo: un dígito mal tecleado. Se prueba
   * cambiando CADA posición de CADA IMEI real por CADA otro dígito.
   */
  it("atrapa cualquier dígito cambiado, en cualquier posición", () => {
    for (const imei of REALES) {
      for (let pos = 0; pos < 15; pos++) {
        for (let d = 0; d <= 9; d++) {
          if (String(d) === imei[pos]) continue;
          const malo = imei.slice(0, pos) + d + imei.slice(pos + 1);
          expect(digitoVerificadorCuadra(malo), `${malo} (posición ${pos})`).toBe(false);
        }
      }
    }
  });

  it("atrapa dos dígitos contiguos invertidos, salvo 0↔9", () => {
    const imei = REALES[0]!;
    for (let pos = 0; pos < 14; pos++) {
      const a = imei[pos]!, b = imei[pos + 1]!;
      if (a === b) continue;
      const invertido = imei.slice(0, pos) + b + a + imei.slice(pos + 2);
      const esCeroNueve = (a === "0" && b === "9") || (a === "9" && b === "0");
      expect(digitoVerificadorCuadra(invertido), invertido).toBe(esCeroNueve);
    }
  });

  it("el mensaje dice qué hacer, no sólo que falló", () => {
    const r = validarImei("860693082402390");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/dígito mal tecleado/);
  });
});

describe("la forma del IMEI", () => {
  /**
   * Antes se guardaba con `trim()` a secas: un espacio en medio quedaba dentro
   * del IMEI y nunca coincidía con Traccar.
   */
  it("quita espacios y guiones de en medio, y guarda sólo los dígitos", () => {
    expect(validarImei(" 8606 9308 2402 380 ")).toEqual({ ok: true, imei: "860693082402380" });
    expect(validarImei("86-0693-0824-02380")).toEqual({ ok: true, imei: "860693082402380" });
    expect(normalizarImei("860 693\t082402380")).toBe("860693082402380");
  });

  it("rechaza letras, con un mensaje que lo diga", () => {
    const r = validarImei("86069308240238O");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toMatch(/no son dígitos/);
  });

  it("rechaza el largo equivocado diciendo cuántos trae", () => {
    const corto = validarImei("86069308240238");
    expect(!corto.ok && corto.motivo).toMatch(/14 dígitos y debe tener 15/);
    const largo = validarImei("8606930824023800");
    expect(!largo.ok && largo.motivo).toMatch(/16 dígitos/);
  });

  it("vacío es requerido", () => {
    expect(validarImei("   ")).toEqual({ ok: false, motivo: "El IMEI es requerido." });
  });
});
