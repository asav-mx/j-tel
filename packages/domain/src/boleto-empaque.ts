import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import type { BoletoSellado, CuerpoDeBoleto, Presentacion } from "./boleto.js";

/**
 * Cómo cabe una presentación en un QR — Ontoy 3.0 · PR P2.
 *
 * ## Por qué existe este archivo
 *
 * El QR lo lee una cámara barata, dentro de un camión, con el brazo estirado y
 * el camión moviéndose. **Cuántos cuadritos tiene el código decide si se lee a
 * la primera o si la fila se detiene.**
 *
 * Una presentación en JSON con sus campos en hexadecimal pasa de 500
 * caracteres. Los mismos datos empacados aquí caben en ~280: el QR baja de unos
 * 81 cuadritos de lado a unos 57, y cada cuadrito pasa de 2.6 a 3.7 píxeles en
 * la caja de 216 px del diseño. Es la diferencia entre enfocar y adivinar.
 *
 * ## Cómo
 *
 * Todo en **un solo bloque de bytes** y de ahí a base64url. Nada de separadores
 * entre campos: los textos van con su largo por delante, así que un folio con
 * cualquier carácter adentro no puede correr la frontera del campo siguiente.
 * Es la misma preocupación que `boleto.ts` resuelve con `cuerpoEstaBienFormado`,
 * por el otro camino.
 *
 * Las firmas (64 bytes cada una) y la llave del portador (32) son lo que son:
 * 160 bytes irreducibles de Ed25519. Lo demás es el sobre.
 *
 * **Desempacar no confía en nada.** Lo que llega es lo que alguien enseñó en una
 * pantalla: cualquier cosa rara devuelve `null`, y lo que sí se arma todavía
 * tiene que pasar entero por `verificarBoleto`. Esto no valida: sólo desarma.
 */

const VERSION = 1;

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function aBase64Url(bytes: Uint8Array): string {
  let salida = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : undefined;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : undefined;
    salida += ALFABETO[a >> 2]!;
    salida += ALFABETO[((a & 0b11) << 4) | ((b ?? 0) >> 4)]!;
    if (b === undefined) break;
    salida += ALFABETO[((b & 0b1111) << 2) | ((c ?? 0) >> 6)]!;
    if (c === undefined) break;
    salida += ALFABETO[c & 0b111111]!;
  }
  return salida;
}

export function deBase64Url(texto: string): Uint8Array | null {
  const bytes: number[] = [];
  let acumulado = 0;
  let bits = 0;
  for (const caracter of texto) {
    const valor = ALFABETO.indexOf(caracter);
    if (valor < 0) return null;
    acumulado = (acumulado << 6) | valor;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acumulado >> bits) & 0xff);
    }
  }
  /* Los bits sueltos del final son relleno y tienen que ser ceros: si traen
     algo, el texto no salió de `aBase64Url` y no se adivina qué quiso decir. */
  if (bits > 0 && (acumulado & ((1 << bits) - 1)) !== 0) return null;
  return Uint8Array.from(bytes);
}

function escribirEntero(destino: number[], valor: number, bytes: number): void {
  for (let i = bytes - 1; i >= 0; i--) destino.push(Math.floor(valor / 2 ** (8 * i)) % 256);
}

function leerEntero(origen: Uint8Array, desde: number, bytes: number): number {
  let valor = 0;
  for (let i = 0; i < bytes; i++) valor = valor * 256 + origen[desde + i]!;
  return valor;
}

/** Lo que va dentro del QR, en texto. */
export function empacarPresentacion(presentacion: Presentacion): string {
  const { cuerpo, firmaDeJTel } = presentacion.boleto;
  const folio = utf8ToBytes(cuerpo.folio);
  const ruta = utf8ToBytes(cuerpo.ruta);
  if (folio.length > 255 || ruta.length > 255) {
    throw new Error("El folio y la ruta de un boleto no pasan de 255 bytes cada uno");
  }

  const bloque: number[] = [VERSION, folio.length, ...folio, ruta.length, ...ruta];
  escribirEntero(bloque, cuerpo.emitido, 6);
  escribirEntero(bloque, cuerpo.vence, 6);
  escribirEntero(bloque, presentacion.ventana, 4);
  bloque.push(...hexToBytes(cuerpo.portador));
  bloque.push(...hexToBytes(firmaDeJTel));
  bloque.push(...hexToBytes(presentacion.pruebaDelPortador));

  return aBase64Url(Uint8Array.from(bloque));
}

/** Lo que el validador leyó de la cámara, desarmado. `null` si no cuadra. */
export function desempacarPresentacion(texto: string): Presentacion | null {
  const bloque = deBase64Url(texto);
  if (bloque === null || bloque.length < 2) return null;
  if (bloque[0] !== VERSION) return null;

  let i = 1;
  const leerTexto = (): string | null => {
    if (i >= bloque.length) return null;
    const largo = bloque[i]!;
    i += 1;
    if (i + largo > bloque.length) return null;
    const crudo = bloque.subarray(i, i + largo);
    i += largo;
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(crudo);
    } catch {
      return null;
    }
  };

  const folio = leerTexto();
  if (folio === null) return null;
  const ruta = leerTexto();
  if (ruta === null) return null;

  /* 6 + 6 + 4 de las fechas y la ventana, más 32 + 64 + 64 de llave y firmas. */
  if (bloque.length - i !== 176) return null;

  const emitido = leerEntero(bloque, i, 6);
  const vence = leerEntero(bloque, i + 6, 6);
  const ventana = leerEntero(bloque, i + 12, 4);
  i += 16;

  const cuerpo: CuerpoDeBoleto = {
    folio,
    ruta,
    emitido,
    vence,
    unSoloUso: true,
    portador: bytesToHex(bloque.subarray(i, i + 32)),
  };
  const boleto: BoletoSellado = {
    cuerpo,
    firmaDeJTel: bytesToHex(bloque.subarray(i + 32, i + 96)),
  };
  return {
    boleto,
    ventana,
    pruebaDelPortador: bytesToHex(bloque.subarray(i + 96, i + 160)),
  };
}
