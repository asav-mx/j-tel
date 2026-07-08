import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

/**
 * Cifrado simétrico para secretos guardados en la base (ej. contraseñas de
 * proveedores GPS). Usa AES-256-GCM con una llave derivada de JTEL_SECRET_KEY.
 *
 * Formato almacenado: "gcm:<ivB64>:<tagB64>:<cipherB64>".
 */

const PREFIX = "gcm";

function getKey(): Buffer {
  const raw = process.env.JTEL_SECRET_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error(
      "JTEL_SECRET_KEY no está configurada. Es necesaria para cifrar/descifrar credenciales.",
    );
  }
  // Derivamos 32 bytes de forma estable a partir de la llave provista,
  // así aceptamos llaves de cualquier longitud/formato.
  return createHash("sha256").update(raw.trim()).digest();
}

export function isEncryptionConfigured(): boolean {
  return Boolean(process.env.JTEL_SECRET_KEY && process.env.JTEL_SECRET_KEY.trim().length > 0);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Formato de secreto inválido.");
  }
  const key = getKey();
  const iv = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const ciphertext = Buffer.from(parts[3]!, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
