import { describe, it, expect } from "vitest";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import {
  LLAVE_DE_LABORATORIO,
  crearPortador,
  emitirBoleto,
  presentarBoleto,
  verificarBoleto,
} from "./boleto.js";
import {
  empacarPresentacion,
  desempacarPresentacion,
  aBase64Url,
  deBase64Url,
} from "./boleto-empaque.js";

const MEDIODIA = Date.UTC(2026, 8, 23, 12, 0, 0);
const PORTADOR = crearPortador(utf8ToBytes("portador de prueba"));

function presentacionDePrueba(folio = "ONT-000123", ruta = "circuito-juarez-1") {
  const boleto = emitirBoleto(
    {
      folio,
      ruta,
      emitido: MEDIODIA - 60 * 60 * 1000,
      vence: MEDIODIA + 60 * 60 * 1000,
      portador: PORTADOR.publica,
    },
    LLAVE_DE_LABORATORIO,
  );
  return presentarBoleto(boleto, PORTADOR, MEDIODIA);
}

describe("base64url", () => {
  it("va y vuelve con cualquier largo", () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) % 256);
      expect(deBase64Url(aBase64Url(bytes))).toEqual(bytes);
    }
  });

  it("no usa +, / ni =, que un QR y una URL tratan distinto", () => {
    const texto = aBase64Url(Uint8Array.from({ length: 64 }, (_, i) => i * 4));
    expect(texto).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rechaza un carácter que no es del alfabeto", () => {
    expect(deBase64Url("AAAA*AAA")).toBeNull();
  });

  /* Si los bits de relleno traen algo, el texto no salió de aquí: dos cadenas
     distintas darían los mismos bytes, y entonces un QR tendría gemelos. */
  it("rechaza relleno que no sea cero", () => {
    expect(deBase64Url("AB")).toBeNull();
    expect(deBase64Url("AA")).toEqual(Uint8Array.from([0]));
  });
});

describe("el empaque de la presentación", () => {
  it("va y vuelve idéntica", () => {
    const presentacion = presentacionDePrueba();
    expect(desempacarPresentacion(empacarPresentacion(presentacion))).toEqual(presentacion);
  });

  /* La razón de existir del archivo: que el QR se lea a la primera dentro de un
     camión. Si alguien engorda el formato, esta prueba lo dice. */
  it("cabe en menos de 300 caracteres", () => {
    const texto = empacarPresentacion(presentacionDePrueba());
    expect(texto.length).toBeLessThan(300);
    /* Y es bastante más chico que el JSON en hexadecimal que reemplaza. */
    expect(texto.length).toBeLessThan(JSON.stringify(presentacionDePrueba()).length * 0.65);
  });

  it("un folio con puntos, acentos o emoji va y vuelve entero", () => {
    for (const folio of ["ONT.000.123", "Boleto Ñ-á", "🎫-7", ""]) {
      const presentacion = presentacionDePrueba(folio || "x");
      const vuelta = desempacarPresentacion(empacarPresentacion(presentacion));
      expect(vuelta?.boleto.cuerpo.folio).toBe(folio || "x");
    }
  });

  it("lo empacado todavía pasa por el verificador", () => {
    const vuelta = desempacarPresentacion(empacarPresentacion(presentacionDePrueba()));
    expect(vuelta).not.toBeNull();
    expect(
      verificarBoleto(vuelta!, {
        llavePublicaDeJTel: LLAVE_DE_LABORATORIO.publica,
        ahora: MEDIODIA,
      }),
    ).toEqual({ pasa: true, folio: "ONT-000123" });
  });

  /* Desempacar no valida: sólo desarma. Quien cambie un byte de la firma
     obtiene una presentación bien formada que el verificador tira. */
  it("cambiar un byte del empaque no cuela: lo atrapa el verificador", () => {
    const texto = empacarPresentacion(presentacionDePrueba());
    const i = texto.length - 5;
    const otroCaracter = texto[i] === "A" ? "B" : "A";
    const alterado = texto.slice(0, i) + otroCaracter + texto.slice(i + 1);

    const vuelta = desempacarPresentacion(alterado);
    if (vuelta === null) return; // también es una respuesta honesta
    expect(
      verificarBoleto(vuelta, {
        llavePublicaDeJTel: LLAVE_DE_LABORATORIO.publica,
        ahora: MEDIODIA,
      }).pasa,
    ).toBe(false);
  });

  it("devuelve null ante basura, vacío, truncado o de más", () => {
    const bueno = empacarPresentacion(presentacionDePrueba());
    expect(desempacarPresentacion("")).toBeNull();
    expect(desempacarPresentacion("hola mundo")).toBeNull();
    expect(desempacarPresentacion(bueno.slice(0, bueno.length - 8))).toBeNull();
    expect(desempacarPresentacion(bueno + "AAAA")).toBeNull();
  });

  it("devuelve null si la versión no es la que entiende", () => {
    const bytes = deBase64Url(empacarPresentacion(presentacionDePrueba()))!;
    bytes[0] = 9;
    expect(desempacarPresentacion(aBase64Url(bytes))).toBeNull();
  });
});
