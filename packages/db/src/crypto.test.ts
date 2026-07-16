import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encryptSecret, decryptSecret, isEncryptionConfigured } from "./crypto.js";

const ORIGINAL_KEY = process.env.JTEL_SECRET_KEY;

describe("crypto (AES-256-GCM)", () => {
  beforeEach(() => {
    process.env.JTEL_SECRET_KEY = "clave-de-prueba";
  });

  afterEach(() => {
    if (ORIGINAL_KEY === undefined) {
      delete process.env.JTEL_SECRET_KEY;
    } else {
      process.env.JTEL_SECRET_KEY = ORIGINAL_KEY;
    }
  });

  describe("isEncryptionConfigured", () => {
    it("true cuando hay llave", () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it("false cuando la llave falta o está vacía", () => {
      delete process.env.JTEL_SECRET_KEY;
      expect(isEncryptionConfigured()).toBe(false);
      process.env.JTEL_SECRET_KEY = "   ";
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe("encryptSecret / decryptSecret", () => {
    it("hace round-trip del texto plano", () => {
      const secret = "sup3r-secreto-GPS";
      const encrypted = encryptSecret(secret);
      expect(decryptSecret(encrypted)).toBe(secret);
    });

    it("produce el formato gcm:<iv>:<tag>:<cipher>", () => {
      const encrypted = encryptSecret("hola");
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe("gcm");
    });

    it("usa un IV aleatorio por cada cifrado", () => {
      const a = encryptSecret("mismo");
      const b = encryptSecret("mismo");
      expect(a).not.toBe(b);
      expect(decryptSecret(a)).toBe("mismo");
      expect(decryptSecret(b)).toBe("mismo");
    });

    it("maneja cadenas vacías y unicode", () => {
      expect(decryptSecret(encryptSecret(""))).toBe("");
      expect(decryptSecret(encryptSecret("piña 🚌 ñ"))).toBe("piña 🚌 ñ");
    });

    it("lanza error si el secreto tiene formato inválido", () => {
      expect(() => decryptSecret("no-es-valido")).toThrow(/Formato de secreto inválido/);
      expect(() => decryptSecret("aes:1:2:3")).toThrow(/Formato de secreto inválido/);
    });

    it("falla al descifrar con una llave distinta", () => {
      const encrypted = encryptSecret("secreto");
      process.env.JTEL_SECRET_KEY = "otra-llave";
      expect(() => decryptSecret(encrypted)).toThrow();
    });

    it("lanza error de configuración si falta la llave", () => {
      delete process.env.JTEL_SECRET_KEY;
      expect(() => encryptSecret("x")).toThrow(/JTEL_SECRET_KEY/);
    });
  });
});
