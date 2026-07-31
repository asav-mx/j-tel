import { describe, expect, it } from "vitest";
import { tiraDeFlota } from "./historial-flota";

const T = (hhmm: string) => new Date(`2026-07-30T${hhmm}:00.000Z`);
const franja = { desde: T("00:00"), hasta: T("24:00") };

const clases = (bloques: Array<{ desde: Date; hasta: Date }>, f = franja) =>
  tiraDeFlota(f, bloques).map((t) => t.clase);

describe("la tira de la flota", () => {
  it("una unidad muda es un solo tramo sin dato, del ancho de la franja", () => {
    const tira = tiraDeFlota(franja, []);

    expect(tira).toHaveLength(1);
    expect(tira[0]).toMatchObject({ clase: "sin_dato", minutos: 1440 });
  });

  it("los bordes cuentan como hueco", () => {
    // Si la tira empezara en el primer punto, la franja se vería observada
    // de punta a punta cuando la unidad reportó solo dos horas.
    const tira = tiraDeFlota(franja, [{ desde: T("06:00"), hasta: T("08:00") }]);

    expect(tira.map((t) => t.clase)).toEqual(["sin_dato", "observado", "sin_dato"]);
    expect(tira[0]!.minutos).toBe(360);
    expect(tira[1]!.minutos).toBe(120);
    expect(tira[2]!.minutos).toBe(960);
  });

  it("intercala los silencios entre bloques", () => {
    expect(
      clases([
        { desde: T("06:00"), hasta: T("08:00") },
        { desde: T("09:00"), hasta: T("11:00") },
        { desde: T("14:00"), hasta: T("16:00") },
      ]),
    ).toEqual([
      "sin_dato",
      "observado",
      "sin_dato",
      "observado",
      "sin_dato",
      "observado",
      "sin_dato",
    ]);
  });

  it("no inventa un hueco donde el bloque toca el borde", () => {
    expect(clases([{ desde: T("00:00"), hasta: T("24:00") }])).toEqual(["observado"]);
  });

  it("no depende de que los bloques lleguen ordenados", () => {
    const desordenados = [
      { desde: T("14:00"), hasta: T("16:00") },
      { desde: T("06:00"), hasta: T("08:00") },
    ];

    expect(clases(desordenados)).toEqual([
      "sin_dato",
      "observado",
      "sin_dato",
      "observado",
      "sin_dato",
    ]);
  });

  it("descarta los tramos de duración cero", () => {
    // Un punto aislado deja un bloque que empieza y termina en el mismo
    // instante: no se puede dibujar, y dejarlo mete una raya de ancho mínimo
    // que se lee como dato donde no hay tiempo que mostrar.
    const tira = tiraDeFlota(franja, [{ desde: T("06:00"), hasta: T("06:00") }]);

    expect(tira.map((t) => t.clase)).toEqual(["sin_dato", "sin_dato"]);
    expect(tira.every((t) => t.minutos > 0)).toBe(true);
  });

  it("una franja de largo cero no dibuja nada", () => {
    expect(tiraDeFlota({ desde: T("06:00"), hasta: T("06:00") }, [])).toEqual([]);
  });

  it("los tramos cubren la franja entera, sin huecos ni encimados", () => {
    const tira = tiraDeFlota(franja, [
      { desde: T("06:00"), hasta: T("08:00") },
      { desde: T("09:00"), hasta: T("11:00") },
    ]);

    // La tira se dibuja a escala: si los tramos no cubrieran exactamente la
    // franja, el renglón mostraría espacio vacío que no significa nada.
    expect(tira[0]!.desde).toEqual(franja.desde);
    expect(tira[tira.length - 1]!.hasta).toEqual(franja.hasta);
    for (let i = 1; i < tira.length; i++) {
      expect(tira[i]!.desde).toEqual(tira[i - 1]!.hasta);
    }
    expect(tira.reduce((t, s) => t + s.minutos, 0)).toBeCloseTo(1440, 6);
  });

  it("una franja que cruza medianoche se dibuja igual", () => {
    const nocturna = { desde: T("22:00"), hasta: new Date("2026-07-31T06:00:00.000Z") };
    const tira = tiraDeFlota(nocturna, [
      { desde: T("23:00"), hasta: new Date("2026-07-31T02:00:00.000Z") },
    ]);

    expect(tira.map((t) => t.clase)).toEqual(["sin_dato", "observado", "sin_dato"]);
    expect(tira.reduce((t, s) => t + s.minutos, 0)).toBeCloseTo(480, 6);
  });
});
