import { describe, it, expect } from "vitest";
import { encode } from "uqr";
import {
  LLAVE_DE_LABORATORIO,
  crearPortador,
  emitirBoleto,
  presentarBoleto,
  verificarBoleto,
} from "@jtel/domain/boleto";
import { empacarPresentacion, desempacarPresentacion } from "@jtel/domain/boleto-empaque";
import { leerQr } from "./leer-qr";
import { PIXELES_POR_MODULO } from "./encuadre";

/**
 * **La vuelta completa: escribir el QR y volverlo a leer.**
 *
 * Esto es lo que ninguna captura de pantalla prueba. El pase dibuja un código y
 * el lector tiene que sacar de ahí el mismo boleto, verificarlo y decir que
 * pasa. Si el empaque, el codificador o el lector dejan de entenderse, aquí se
 * cae — y no dentro de un camión.
 */

const MEDIODIA = Date.UTC(2026, 8, 23, 12, 0, 0);

/** Pinta el código como lo vería una cámara: negro sobre blanco, con su margen. */
function comoLoVeLaCamara(texto: string, escala = 6, margen = 4) {
  const { size, data } = encode(texto, { ecc: "M" });
  const lado = (size + margen * 2) * escala;
  const pixeles = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y]?.[x]) continue;
      for (let dy = 0; dy < escala; dy++) {
        for (let dx = 0; dx < escala; dx++) {
          const px = (x + margen) * escala + dx;
          const py = (y + margen) * escala + dy;
          const i = (py * lado + px) * 4;
          pixeles[i] = pixeles[i + 1] = pixeles[i + 2] = 0;
        }
      }
    }
  }
  return { pixeles, lado };
}

function paseDePrueba() {
  const portador = crearPortador(new TextEncoder().encode("portador de la vuelta completa"));
  const sellado = emitirBoleto(
    {
      folio: "ONT-00042042",
      ruta: "cualquier-circuito",
      emitido: MEDIODIA - 1000,
      vence: MEDIODIA + 90 * 24 * 60 * 60 * 1000,
      portador: portador.publica,
    },
    LLAVE_DE_LABORATORIO,
  );
  return presentarBoleto(sellado, portador, MEDIODIA);
}

describe("del pase a la cámara y de vuelta", () => {
  it("el lector saca del QR el mismo boleto, y el verificador lo deja pasar", () => {
    const presentacion = paseDePrueba();
    const { pixeles, lado } = comoLoVeLaCamara(empacarPresentacion(presentacion));

    const leido = leerQr(pixeles, lado, lado);
    expect(leido).not.toBeNull();

    const vuelta = desempacarPresentacion(leido!);
    expect(vuelta).toEqual(presentacion);

    expect(
      verificarBoleto(vuelta!, {
        llavePublicaDeJTel: LLAVE_DE_LABORATORIO.publica,
        ahora: MEDIODIA,
      }),
    ).toEqual({ pasa: true, folio: "ONT-00042042" });
  });

  /* En un camión el código nunca sale a pantalla completa ni perfectamente
     encuadrado: si sólo se leyera a escala grande, el lector no serviría. */
  it("se lee aunque el código salga chico en el cuadro", () => {
    const texto = empacarPresentacion(paseDePrueba());
    for (const escala of [3, 4, 8]) {
      const { pixeles, lado } = comoLoVeLaCamara(texto, escala);
      expect(leerQr(pixeles, lado, lado), `escala ${escala}`).toBe(texto);
    }
  });

  it("un cuadro en blanco no inventa nada", () => {
    const lado = 240;
    const blanco = new Uint8ClampedArray(lado * lado * 4).fill(255);
    expect(leerQr(blanco, lado, lado)).toBeNull();
  });
});

describe("el tamaño del código, fijado", () => {
  /*
   * Este número se midió mal una vez —con un texto de puras mayúsculas, que el
   * QR codifica en modo alfanumérico— y acabó escrito en un comentario y en el
   * cuerpo de un PR. Ahora lo fija una prueba con la carga de verdad: si el
   * empaque engorda, el código crece, cada cuadrito se encoge en la pantalla y
   * la cámara empieza a dudar. Que se lea aquí y no en un camión.
   */
  it("con la carga real son 67 cuadritos de lado, no más", () => {
    const { size } = encode(empacarPresentacion(paseDePrueba()), { ecc: "M" });
    expect(size).toBeLessThanOrEqual(67);
  });
});

/** Desenfoque de caja: lo que deja un pulso, un enfoque a medias, un camión andando. */
function desenfocar(px: Uint8ClampedArray, lado: number, radio: number): Uint8ClampedArray {
  const salida = new Uint8ClampedArray(px);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let suma = 0;
      let n = 0;
      for (let dy = -radio; dy <= radio; dy++) {
        for (let dx = -radio; dx <= radio; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || xx < 0 || yy >= lado || xx >= lado) continue;
          suma += px[(yy * lado + xx) * 4]!;
          n++;
        }
      }
      const i = (y * lado + x) * 4;
      salida[i] = salida[i + 1] = salida[i + 2] = suma / n;
    }
  }
  return salida;
}

describe("cuántos píxeles por módulo hace falta de verdad", () => {
  /*
   * **El número que explicó por qué el lector no leía en la calle.**
   *
   * Con una imagen perfecta jsQR saca nuestro QR hasta con 1 px por módulo, y
   * por eso la prueba de la cámara falsa pasaba mientras dos teléfonos de
   * verdad fallaban: un lienzo dibujado no tiene desenfoque. Medido con
   * desenfoque de radio 2 px —el normal de una cámara que no acabó de
   * enfocar— el umbral sube a 4, cuatro veces más resolución.
   *
   * De aquí sale `PIXELES_POR_MODULO` en `encuadre.ts`, y de ahí que el lector
   * ya no encoja el fotograma.
   */
  it("con desenfoque de cámara pide 4 px por módulo, no 1", () => {
    const texto = empacarPresentacion(paseDePrueba());
    const conBorde = (n: number) => {
      const { pixeles, lado } = comoLoVeLaCamara(texto, n);
      return { pixeles: desenfocar(pixeles, lado, 2), lado };
    };

    const flojo = conBorde(2);
    expect(leerQr(flojo.pixeles, flojo.lado, flojo.lado)).toBeNull();

    for (const n of [PIXELES_POR_MODULO, PIXELES_POR_MODULO + 2]) {
      const holgado = conBorde(n);
      expect(leerQr(holgado.pixeles, holgado.lado, holgado.lado), `${n} px por módulo`).toBe(texto);
    }
  });
});
