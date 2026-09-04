import { describe, it, expect } from "vitest";
import { diaYMes, duracion, fechaCivilLarga, margen } from "./formato-tiempo";

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

describe("diaYMes · el día como lo diría una persona", () => {
  const JUAREZ = "America/Ciudad_Juarez";
  const ahora = new Date("2026-08-29T18:00:00.000Z");

  it("dentro del año en curso no arrastra el año", () => {
    expect(diaYMes(new Date("2026-08-20T08:39:00.000Z"), JUAREZ, ahora)).toBe("20 de agosto");
  });

  it("de otro año SÍ lo dice: si no, es un dato correcto leído como falso", () => {
    expect(diaYMes(new Date("2025-11-03T18:00:00.000Z"), JUAREZ, ahora)).toBe(
      "3 de noviembre de 2025",
    );
  });

  it("el día es el de la ZONA DEL CIRCUITO, no el del proceso", () => {
    /*
     * 05:30 UTC del día 21 son las 23:30 del 20 en Ciudad Juárez. Formatear sin
     * zona daría «21 de agosto» en el servidor y «20» en el teléfono de quien
     * mira, para la misma fila.
     */
    expect(diaYMes(new Date("2026-08-21T05:30:00.000Z"), JUAREZ, ahora)).toBe("20 de agosto");
  });
});

describe("fechaCivilLarga · la fecha que se declara, no la que se sella", () => {
  const JUAREZ = "America/Ciudad_Juarez";

  it("se escribe entera y sin la coma que parte la frase", () => {
    expect(fechaCivilLarga("2026-09-15", JUAREZ)).toBe("martes 15 de septiembre de 2026");
  });

  it("NO SE CORRE POR LA ZONA: es un día civil, no un instante", () => {
    /*
     * `new Date("2026-09-15")` es medianoche UTC, y en Juárez (UTC-6) caería en
     * el 14. Una fecha corrida por uno anuncia el arranque la víspera, y en la
     * pantalla no se ve nada raro.
     */
    expect(fechaCivilLarga("2026-01-01", JUAREZ)).toBe("jueves 1 de enero de 2026");
    expect(fechaCivilLarga("2026-01-01", "UTC")).toBe("jueves 1 de enero de 2026");
  });
});
