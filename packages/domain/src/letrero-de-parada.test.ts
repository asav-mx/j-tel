import { describe, expect, it } from "vitest";
import {
  CASA_DE_ONTOY,
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
