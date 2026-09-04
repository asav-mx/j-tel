import { describe, it, expect } from "vitest";
import { salidaDelBuscador } from "./salida-del-buscador";

const PUBLICADOS = ["oasis-centro", "corredor-prueba"];

describe("la salida del buscador", () => {
  it("con el `desde` de una ruta publicada, vuelve a ESA ruta", () => {
    expect(salidaDelBuscador("oasis-centro", PUBLICADOS)).toEqual({
      href: "/c/oasis-centro",
      etiqueta: "Volver a la ruta",
    });
  });

  it("sin `desde` —liga compartida, QR, arranque de la app— vuelve a la portada", () => {
    expect(salidaDelBuscador(null, PUBLICADOS).href).toBe("/");
    expect(salidaDelBuscador(undefined, PUBLICADOS).etiqueta).toBe("Volver al inicio");
  });

  it("UN `desde` INVENTADO no produce un botón que promete una ruta y da 404", () => {
    /*
     * El parámetro viaja en la URL, así que lo escribe quien quiera. Sin el
     * cotejo, el rótulo diría «Volver a la ruta» y aterrizaría en la pantalla
     * de «no encontramos esa ruta» — un letrero prometiendo algo que no está
     * detrás de la puerta.
     */
    const s = salidaDelBuscador("ruta-que-no-existe", PUBLICADOS);
    expect(s.href).toBe("/");
    expect(s.etiqueta).toBe("Volver al inicio");
  });

  it("un circuito SIN PUBLICAR tampoco es destino, aunque exista en la base", () => {
    // La lista que entra aquí es la de publicados, y es la única que decide.
    expect(salidaDelBuscador("corredor-prueba", ["oasis-centro"]).href).toBe("/");
  });

  it("sin ninguna ruta publicada, la salida sigue existiendo", () => {
    // El caso del arranque, y el que no puede quedarse sin botón: una pantalla
    // sin salida es lo que este arreglo vino a quitar.
    expect(salidaDelBuscador("oasis-centro", []).href).toBe("/");
  });

  it("el vacío no cuenta como ruta", () => {
    expect(salidaDelBuscador("", PUBLICADOS).href).toBe("/");
  });

  it("SIEMPRE devuelve un destino: nunca `null`, nunca «atrás»", () => {
    /*
     * La forma es la valla. Si esto pudiera devolver `null`, la pantalla
     * tendría que decidir qué hacer sin destino — y la respuesta fácil ahí es
     * `history.back()`, que en la app instalada no hace nada.
     */
    for (const desde of [null, "", "x", "oasis-centro"]) {
      const s = salidaDelBuscador(desde, PUBLICADOS);
      expect(s.href.startsWith("/")).toBe(true);
      expect(s.etiqueta.length).toBeGreaterThan(0);
    }
  });
});
