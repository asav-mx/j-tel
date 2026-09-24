import { describe, expect, it } from "vitest";
import {
  palabrasDeLaFlota,
  seEsperaAhora,
  veredictoDeLaFlota,
  type UnidadEsperada,
} from "./quien-deberia-hablar.js";

/**
 * El caso que estas pruebas existen para impedir es el **#470**: tres días de
 * gritos por una flota estacionada. Por eso el primer bloque es ése, con sus
 * números reales.
 */

const UNIDAD = (extra: Partial<UnidadEsperada> = {}): UnidadEsperada => ({
  unidad: "2120",
  carrier: "Juárez Bus",
  circuito: "Oasis-Centro",
  abre: "09:53:00",
  cierra: "22:00:00",
  zona: "America/Ciudad_Juarez",
  arrancaEl: null,
  minutosSinHablar: 3,
  ...extra,
});

/* 2026-09-23 15:00 en Juárez = 21:00Z. Dentro del horario del circuito. */
const EN_TURNO = new Date("2026-09-23T21:00:00Z");
/* 04:00 en Juárez = 10:00Z. Antes de que abra. */
const DE_MADRUGADA = new Date("2026-09-23T10:00:00Z");

describe("el #470: una flota estacionada no es una emergencia", () => {
  it("fuera de horario no hay nada que vigilar, por callada que esté", () => {
    const callada = UNIDAD({ minutosSinHablar: 68 * 60 });
    expect(veredictoDeLaFlota([callada], DE_MADRUGADA, 20)).toEqual({
      que: "dormida",
      montadas: 1,
    });
  });

  it("y lo dice sin gritar, diciendo de cuántas habla", () => {
    const v = veredictoDeLaFlota([UNIDAD(), UNIDAD({ unidad: "2126" })], DE_MADRUGADA, 20);
    expect(palabrasDeLaFlota(v)).toBe(
      "fuera de horario de servicio · 2 unidades montadas, ninguna en turno",
    );
  });

  /*
   * El otro lado de la misma moneda: «dormida» con CERO montadas no es lo
   * mismo que «dormida» con dos. La primera es que nadie configuró nada, y se
   * ve igual si no se dice.
   */
  it("sin ninguna unidad montada lo dice distinto: eso es otro problema", () => {
    const v = veredictoDeLaFlota([], EN_TURNO, 20);
    expect(v).toEqual({ que: "dormida", montadas: 0 });
    expect(palabrasDeLaFlota(v)).toBe("ninguna unidad con aparato corre un circuito publicado");
  });
});

describe("en turno, sí se espera oírla", () => {
  it("al día si habló dentro del umbral", () => {
    expect(veredictoDeLaFlota([UNIDAD({ minutosSinHablar: 3 })], EN_TURNO, 20)).toEqual({
      que: "al_dia",
      hablando: 1,
    });
  });

  it("alarma si pasa el umbral, y la frase dice QUIÉN y DESDE CUÁNDO", () => {
    const v = veredictoDeLaFlota([UNIDAD({ minutosSinHablar: 45 })], EN_TURNO, 20);
    expect(v.que).toBe("calla");
    expect(palabrasDeLaFlota(v)).toBe("2120 (Oasis-Centro) calla hace 45 min");
  });

  /* Horas para lo que lleva horas: «calla hace 4080 min» no se lee. */
  it("en horas cuando ya son horas", () => {
    const v = veredictoDeLaFlota([UNIDAD({ minutosSinHablar: 68 * 60 })], EN_TURNO, 20);
    expect(palabrasDeLaFlota(v)).toBe("2120 (Oasis-Centro) calla hace 68.0 h");
  });

  /*
   * «Nunca habló» y «lleva mucho sin hablar» son dos cosas. Un aparato recién
   * montado que jamás mandó un punto es un problema de instalación; uno que
   * calla desde ayer es otro.
   */
  it("la que nunca habló se dice con esas palabras, no con un número enorme", () => {
    const v = veredictoDeLaFlota([UNIDAD({ minutosSinHablar: null })], EN_TURNO, 20);
    expect(v.que).toBe("calla");
    expect(palabrasDeLaFlota(v)).toBe("2120 (Oasis-Centro) nunca ha hablado");
  });

  it("una que calla no tapa a las que sí hablan: se cuentan aparte", () => {
    const v = veredictoDeLaFlota(
      [UNIDAD({ minutosSinHablar: 2 }), UNIDAD({ unidad: "2126", minutosSinHablar: 300 })],
      EN_TURNO,
      20,
    );
    expect(v).toMatchObject({ que: "calla", hablando: 1 });
  });

  /* Tres nombres y el resto contado: una lista de quince no se lee en un aviso. */
  it("con muchas calladas, nombra tres y cuenta el resto", () => {
    const muchas = ["A", "B", "C", "D", "E"].map((n) =>
      UNIDAD({ unidad: n, minutosSinHablar: 60 }),
    );
    expect(palabrasDeLaFlota(veredictoDeLaFlota(muchas, EN_TURNO, 20))).toContain("y 2 más");
  });
});

describe("las tres condiciones de «se espera oírla»", () => {
  it("dentro del horario del circuito, sí", () => {
    expect(seEsperaAhora(UNIDAD(), EN_TURNO)).toBe(true);
  });

  it("antes de abrir, no", () => {
    expect(seEsperaAhora(UNIDAD(), DE_MADRUGADA)).toBe(false);
  });

  /* El horario es el del circuito y su zona, no una constante escrita aquí. */
  it("cada circuito manda con SU horario, no con uno de la casa", () => {
    const madrugador = UNIDAD({ abre: "01:00:00", cierra: "23:00:00" });
    expect(seEsperaAhora(madrugador, DE_MADRUGADA)).toBe(true);
    expect(seEsperaAhora(UNIDAD(), DE_MADRUGADA)).toBe(false);
  });

  /* Un circuito que todavía no arranca no promete nada, así que no se espera. */
  it("un circuito que aún no arranca no se vigila", () => {
    expect(seEsperaAhora(UNIDAD({ arrancaEl: "2027-01-01" }), EN_TURNO)).toBe(false);
    expect(seEsperaAhora(UNIDAD({ arrancaEl: "2026-09-01" }), EN_TURNO)).toBe(true);
  });
});
