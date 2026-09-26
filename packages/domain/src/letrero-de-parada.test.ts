import { describe, expect, it } from "vitest";
import {
  CASA_DE_ONTOY,
  etiquetaCortaDeLaRuta,
  numeroDeLaRuta,
  tituloDelQr,
  direccionDelLetrero,
  direccionDelLetreroEnPalabras,
  PUERTA_DEL_LETRERO,
} from "./letrero-de-parada.js";

/**
 * Esta prueba existe para **caerse**.
 *
 * Lo que vigila no es un comportamiento: es una cadena que se imprime en lámina
 * y se atornilla a un poste. El día que alguien cambie el formato «para
 * ordenarlo mejor», cada letrero que ya está en la calle deja de abrir nada, y
 * no hay forma de ir a corregirlos. El rojo de aquí es la única manera de que
 * ese cambio pase por una decisión y no por un descuido.
 */
describe("la dirección del letrero de una parada", () => {
  it("es exactamente ontoy.app/p/‹qr_slug›", () => {
    expect(direccionDelLetrero("zgz-01")).toBe("https://ontoy.app/p/zgz-01");
  });

  it("sus dos piezas son las que están impresas, y no cambian", () => {
    expect(CASA_DE_ONTOY).toBe("https://ontoy.app");
    expect(PUERTA_DEL_LETRERO).toBe("/p/");
  });

  /* No lleva el nombre de ningún transportista, ni el de la ruta. */
  it("no se viste de nadie", () => {
    expect(direccionDelLetrero("zgz-01")).not.toMatch(/juarez|bus|ruta/i);
  });

  it("para teclearla, sin el esquema: nadie escribe https:// en un teléfono", () => {
    expect(direccionDelLetreroEnPalabras("zgz-01")).toBe("ontoy.app/p/zgz-01");
  });

  /*
   * Poder apuntar a un preview es lo que permite imprimir una hoja de prueba
   * sin tocar código — y sin que una hoja de prueba lleve la dirección buena.
   */
  it("acepta otro sitio, y no duplica la diagonal", () => {
    expect(direccionDelLetrero("zgz-01", "https://preview.example")).toBe(
      "https://preview.example/p/zgz-01",
    );
    expect(direccionDelLetrero("zgz-01", "https://preview.example/")).toBe(
      "https://preview.example/p/zgz-01",
    );
  });
});

describe("la etiqueta corta de la ruta, para la placa de Tino", () => {
  it("un nombre corto va tal cual", () => {
    expect(etiquetaCortaDeLaRuta("51")).toBe("51");
    expect(etiquetaCortaDeLaRuta("C4")).toBe("C4");
    expect(etiquetaCortaDeLaRuta("Oasis")).toBe("Oasis");
  });

  it("si la ruta trae número, el NÚMERO es la etiqueta — no las iniciales", () => {
    /*
     * En la calle las rutas se conocen por su número: «la 51», «la T1». Nadie
     * dice «la RT».
     *
     * Lo enseñó la lámina de 40 × 60 cm: «Ruta 51 · Centro–Tecnológico» salía
     * «RT», y eso atornillado a un poste durante años es la ruta equivocada
     * escrita en grande.
     */
    expect(etiquetaCortaDeLaRuta("Ruta 51 · Centro–Tecnológico")).toBe("51");
    expect(etiquetaCortaDeLaRuta("Ruta T1 · Parque industrial")).toBe("T1");
    expect(etiquetaCortaDeLaRuta("Circuito 4 · Oasis a Centro")).toBe("4");
    expect(etiquetaCortaDeLaRuta("Ruta C2 · Centro")).toBe("C2");
  });

  it("un número largo NO es un número de ruta: es un año o un código de otra cosa", () => {
    expect(etiquetaCortaDeLaRuta("Corredor Oriente 2026 · Centro")).toBe("CC");
  });

  it("un nombre largo SIN número va en iniciales, y no apretado hasta ser una mancha", () => {
    // Éste es el caso que salió mal en la primera captura: apretado con
    // `textLength` a los 14 mm de la placa, era una raya gris.
    expect(etiquetaCortaDeLaRuta("Oasis – Parroquia Santa Teresa de Jesús")).toBe("OJ");
    expect(etiquetaCortaDeLaRuta("Zaragoza–Centro")).toBe("ZC");
    expect(etiquetaCortaDeLaRuta("Poniente – Centro")).toBe("PC");
  });

  it("una sola palabra larga da sus dos primeras letras", () => {
    expect(etiquetaCortaDeLaRuta("Panamericana")).toBe("PA");
  });

  it("no revienta con lo que no tiene letras", () => {
    expect(etiquetaCortaDeLaRuta("···············")).toBe("··");
    expect(etiquetaCortaDeLaRuta("   ")).toBe("");
  });
});

describe("el título de la página del QR, que es el nombre del archivo PDF", () => {
  it("una parada: QR · circuito · parada", () => {
    expect(tituloDelQr({ circuito: "Oasis–Centro", parada: "Centro" })).toBe(
      "QR · Oasis–Centro · Centro",
    );
  });

  it("todas: QR · circuito · cuántas", () => {
    expect(tituloDelQr({ circuito: "Oasis–Centro", cuantasParadas: 18 })).toBe(
      "QR · Oasis–Centro · 18 paradas",
    );
  });

  it("una sola parada en plural no dice «1 paradas»", () => {
    expect(tituloDelQr({ circuito: "C4", cuantasParadas: 1 })).toBe("QR · C4 · 1 parada");
  });

  it("la variante va al final, y sólo cuando no es la de por omisión", () => {
    expect(tituloDelQr({ circuito: "Oasis–Centro", parada: "Centro", variante: "cuadrados" })).toBe(
      "QR · Oasis–Centro · Centro · cuadrados",
    );
    expect(
      tituloDelQr({
        circuito: "Oasis–Centro",
        cuantasParadas: 18,
        variante: "cuadrados y esquinas normales",
      }),
    ).toBe("QR · Oasis–Centro · 18 paradas · cuadrados y esquinas normales");
    // vacía, en blanco o ausente: no deja un « · » colgando
    for (const v of [undefined, "", "   "]) {
      expect(tituloDelQr({ circuito: "C4", parada: "Centro", variante: v })).toBe(
        "QR · C4 · Centro",
      );
    }
  });

  it("no trae nada escrito a mano para ningún circuito", () => {
    // Todo sale del dato: con otro circuito, el título es del otro circuito.
    expect(tituloDelQr({ circuito: "Zaragoza–Sur", parada: "Catedral" })).toBe(
      "QR · Zaragoza–Sur · Catedral",
    );
    expect(tituloDelQr({ circuito: " C4 ", parada: "Oasis" })).toBe("QR · C4 · Oasis");
  });
});

describe("el número de la ruta: lo único que va en una placa carbón de lo impreso", () => {
  /*
   * ASAV, 26-sep-2026, antes de imprimir las 18 láminas: nunca iniciales. La
   * placa carbón es para identificadores cortos que existen; sin número, la ruta
   * va con su franja de color y su nombre como texto.
   */
  it("con número, el número", () => {
    expect(numeroDeLaRuta("Ruta 51 · Centro–Tecnológico")).toBe("51");
    expect(numeroDeLaRuta("51")).toBe("51");
    expect(numeroDeLaRuta("Ruta T1 · Parque industrial")).toBe("T1");
    expect(numeroDeLaRuta("C4")).toBe("C4");
  });

  it("sin número, NADA: ni iniciales ni el nombre corto", () => {
    expect(numeroDeLaRuta("Oasis – Parroquia Santa Teresa de Jesús")).toBeNull();
    expect(numeroDeLaRuta("Oasis-Centro")).toBeNull();
    expect(numeroDeLaRuta("Zaragoza–Centro")).toBeNull();
    expect(numeroDeLaRuta("Oasis")).toBeNull();
    expect(numeroDeLaRuta("Panamericana")).toBeNull();
  });

  it("un año no es un número de ruta", () => {
    expect(numeroDeLaRuta("Corredor Oriente 2026 · Centro")).toBeNull();
  });
});
