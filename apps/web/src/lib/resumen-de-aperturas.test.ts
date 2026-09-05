import { describe, it, expect } from "vitest";
import {
  aperturasDeHoy,
  DIAS_DEL_RESUMEN,
  hayRegistro,
  LO_QUE_CUENTA,
  serieDeAperturas,
} from "./resumen-de-aperturas";

const HOY = "2026-09-05";

describe("la serie de aperturas", () => {
  it("enseña siete días, del más reciente al más viejo", () => {
    const s = serieDeAperturas({ hoyLocal: HOY, filas: [], primerDiaConRegistro: HOY });
    expect(s).toHaveLength(DIAS_DEL_RESUMEN);
    expect(s[0].fecha).toBe("2026-09-05");
    expect(s[6].fecha).toBe("2026-08-30");
  });

  it("pone cada día su cifra, y cero donde no hubo nadie", () => {
    const s = serieDeAperturas({
      hoyLocal: HOY,
      filas: [
        { localDate: "2026-09-05", aparatos: 38 },
        { localDate: "2026-09-03", aparatos: 12 },
      ],
      primerDiaConRegistro: "2026-09-03",
    });
    expect(s[0]).toEqual({ fecha: "2026-09-05", aparatos: 38 });
    // El 4 sí se contaba y no abrió nadie distinguible: eso es un cero, y es un dato.
    expect(s[1]).toEqual({ fecha: "2026-09-04", aparatos: 0 });
    expect(s[2]).toEqual({ fecha: "2026-09-03", aparatos: 12 });
  });

  it("UN CERO NO ES UN HUECO: antes del primer registro va `null`", () => {
    /*
     * Es la valla de esta pantalla. Dibujar «0» en un día anterior al contador
     * afirmaría que nadie abrió la app cuando lo cierto es que no había
     * instrumento — y encima sobre el número con el que se va a decidir si la
     * app se está usando.
     */
    const s = serieDeAperturas({
      hoyLocal: HOY,
      filas: [{ localDate: "2026-09-05", aparatos: 38 }],
      primerDiaConRegistro: "2026-09-05",
    });
    expect(s[0].aparatos).toBe(38);
    for (const dia of s.slice(1)) {
      expect(dia.aparatos, dia.fecha).toBeNull();
    }
  });

  it("sin ningún registro, la serie entera es hueco — nunca siete ceros", () => {
    // Es el estado del día que esto se despliega, y el que más fácil miente.
    const s = serieDeAperturas({ hoyLocal: HOY, filas: [], primerDiaConRegistro: null });
    expect(s.every((d) => d.aparatos === null)).toBe(true);
    expect(hayRegistro(s)).toBe(false);
    expect(aperturasDeHoy(s)).toBeNull();
  });

  it("con registro de hoy, `hayRegistro` es verdadero y la cifra grande sale", () => {
    const s = serieDeAperturas({
      hoyLocal: HOY,
      filas: [{ localDate: HOY, aparatos: 4 }],
      primerDiaConRegistro: HOY,
    });
    expect(hayRegistro(s)).toBe(true);
    expect(aperturasDeHoy(s)).toBe(4);
  });

  it("hoy en cero se dice cero, no hueco, si ya se contaba antes", () => {
    const s = serieDeAperturas({
      hoyLocal: HOY,
      filas: [{ localDate: "2026-09-04", aparatos: 9 }],
      primerDiaConRegistro: "2026-09-04",
    });
    expect(aperturasDeHoy(s)).toBe(0);
    expect(s[1].aparatos).toBe(9);
  });

  it("aguanta el cambio de mes sin saltarse días", () => {
    const s = serieDeAperturas({
      hoyLocal: "2026-09-02",
      filas: [],
      primerDiaConRegistro: "2026-08-01",
    });
    expect(s.map((d) => d.fecha)).toEqual([
      "2026-09-02",
      "2026-09-01",
      "2026-08-31",
      "2026-08-30",
      "2026-08-29",
      "2026-08-28",
      "2026-08-27",
    ]);
  });

  it("no cuenta filas de fuera de la ventana", () => {
    const s = serieDeAperturas({
      hoyLocal: HOY,
      filas: [{ localDate: "2026-01-01", aparatos: 999 }],
      primerDiaConRegistro: "2026-01-01",
    });
    expect(s.some((d) => d.aparatos === 999)).toBe(false);
  });
});

describe("lo que el rótulo tiene que decir", () => {
  it("dice que no son personas y que no separa el raspado", () => {
    /*
     * Las dos advertencias van juntas y pegadas a la cifra: son de la misma
     * clase —el número no vale como personas ni como uso limpio— y dejar una
     * fuera deja a la cifra con la mitad de su lectura.
     */
    expect(LO_QUE_CUENTA).toContain("no personas");
    expect(LO_QUE_CUENTA.toLowerCase()).toContain("nat");
    expect(LO_QUE_CUENTA.toLowerCase()).toContain("raspado");
  });

  it("NO llama pasajeros ni visitas a lo que cuenta", () => {
    // Las dos palabras que el número no sostiene, y las dos que saldrían solas
    // si alguien redacta esto de memoria.
    expect(LO_QUE_CUENTA.toLowerCase()).not.toContain("pasajero");
    expect(LO_QUE_CUENTA.toLowerCase()).not.toContain("visita");
  });
});
