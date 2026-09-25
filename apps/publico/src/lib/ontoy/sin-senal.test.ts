import { describe, expect, it } from "vitest";
import { aDondeRegresar, edadDeLaCopia, palabrasSinSenal } from "./sin-senal";

describe("a dónde regresar cuando vuelva la señal", () => {
  it("a la página que se pidió, con su consulta", () => {
    expect(aDondeRegresar("/p/av-tecnologico")).toBe("/p/av-tecnologico");
    expect(aDondeRegresar("/rutas?ruta=51")).toBe("/rutas?ruta=51");
  });

  it("nunca a otro sitio: `//otro.sitio` es un salto a otro dominio", () => {
    expect(aDondeRegresar("//malo.example/x")).toBe("/rutas");
    expect(aDondeRegresar("/\\malo.example")).toBe("/rutas");
    expect(aDondeRegresar("https://malo.example")).toBe("/rutas");
  });

  it("sin dato, o de vuelta a esta misma pantalla (un lazo), a la app", () => {
    expect(aDondeRegresar(null)).toBe("/rutas");
    expect(aDondeRegresar("")).toBe("/rutas");
    expect(aDondeRegresar("/sin-senal")).toBe("/rutas");
    expect(aDondeRegresar("/sin-senal?desde=/p/x")).toBe("/rutas");
  });

  it("pero una página que sólo EMPIEZA igual no es esta pantalla", () => {
    expect(aDondeRegresar("/sin-senales")).toBe("/sin-senales");
  });
});

describe("de cuándo es la copia guardada", () => {
  const ahora = new Date("2026-09-25T21:10:00Z");
  const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toUTCString();

  it("en las palabras del diseño: «de hace 2 min»", () => {
    expect(edadDeLaCopia(hace(2), ahora)).toBe("de hace 2 min");
  });

  it("de minutos a horas a días", () => {
    expect(edadDeLaCopia(hace(0.5), ahora)).toBe("de hace un momento");
    expect(edadDeLaCopia(hace(59), ahora)).toBe("de hace 59 min");
    expect(edadDeLaCopia(hace(60), ahora)).toBe("de hace 1 h");
    expect(edadDeLaCopia(hace(23 * 60 + 59), ahora)).toBe("de hace 23 h");
    expect(edadDeLaCopia(hace(24 * 60), ahora)).toBe("de hace 1 día");
    expect(edadDeLaCopia(hace(3 * 24 * 60), ahora)).toBe("de hace 3 días");
  });

  it("un reloj atrasado no dice «hace −3 min»", () => {
    expect(edadDeLaCopia(hace(-3), ahora)).toBe("de hace un momento");
  });

  it("sin fecha legible se calla: mejor que inventarla", () => {
    expect(edadDeLaCopia(null, ahora)).toBeNull();
    expect(edadDeLaCopia("ayer", ahora)).toBeNull();
  });
});

describe("lo que dice la pantalla", () => {
  it("con copia, lo del diseño, palabra por palabra", () => {
    expect(palabrasSinSenal({ edad: "de hace 2 min" }, "/p/x")).toEqual({
      ayuda: "Te enseño lo último que supe, de hace 2 min. Cuando vuelva la señal, me actualizo solo.",
      boton: { texto: "Ver lo último que supe", a: "/rutas" },
    });
  });

  it("con copia sin fecha, sin edad", () => {
    expect(palabrasSinSenal({ edad: null }, "/p/x").ayuda).toBe(
      "Te enseño lo último que supe. Cuando vuelva la señal, me actualizo solo.",
    );
  });

  it("sin copia no promete lo último que supo: nunca supo nada (ASAV, 25-sep)", () => {
    const p = palabrasSinSenal(null, "/p/x");
    expect(p.ayuda).not.toContain("lo último que supe");
    expect(p.boton).toEqual({ texto: "Volver a intentar", a: "/p/x" });
  });
});
