import { describe, it, expect } from "vitest";
import { duracion, margen } from "./formato-tiempo";

/*
 * `duracion` no tenía prueba, y acaba de ganar un escalón de días. Se fija aquí
 * entera —no sólo lo nuevo— porque la escriben cuatro pantallas y el único modo
 * de que un cambio de formato se note es que algo se rompa al hacerlo.
 */
describe("duracion · una duración se escribe como duración", () => {
  it("por debajo del minuto, segundos", () => {
    expect(duracion(0.5)).toBe("30 s");
  });

  it("minutos, con decimal sólo cuando significa algo", () => {
    expect(duracion(46)).toBe("46 min");
    expect(duracion(46.4)).toBe("46.4 min");
  });

  it("horas con su resto, y sin resto cuando es redondo", () => {
    expect(duracion(134)).toBe("2 h 14 min");
    expect(duracion(120)).toBe("2 h");
  });

  it("un turno de noche conserva sus horas: 31 h no se vuelve «1 día»", () => {
    expect(duracion(31 * 60)).toBe("31 h");
    expect(duracion(47 * 60)).toBe("47 h");
  });

  it("pasadas 48 h se escribe en días: un GPS callado desde mayo se puede leer", () => {
    expect(duracion(48 * 60)).toBe("2 días");
    expect(duracion(90 * 24 * 60)).toBe("90 días");
    expect(duracion(2.5 * 24 * 60)).toBe("2 días 12 h");
  });

  it("el resto nunca produce «24 h», que no existe como resto", () => {
    // 2 días 23 h 40 min: el resto redondea a 24 y tiene que subir un día.
    expect(duracion(2 * 24 * 60 + 23 * 60 + 40)).toBe("3 días");
  });
});

describe("margen · el signo se dice en palabras", () => {
  const limite = new Date("2026-07-24T06:50:00.000Z");

  it("antes y después llevan su palabra, nunca un signo", () => {
    expect(margen(new Date("2026-07-24T06:40:00.000Z"), limite)).toBe("10 min antes");
    expect(margen(new Date("2026-07-24T09:04:00.000Z"), limite)).toBe("2 h 14 min de retraso");
  });

  it("el empate se dice, no se redondea a favor de nadie", () => {
    expect(margen(limite, limite)).toBe("justo en el límite");
  });
});
