import { describe, it, expect } from "vitest";
import {
  huecosDeVentana,
  resumirUnidadDia,
  type BloqueObservado,
} from "./resumen-telemetria.js";

const T = (hhmm: string) => new Date(`2026-07-29T${hhmm}:00Z`);
const VENTANA = { desde: T("06:00"), hasta: T("18:00") }; // 12 h

const bloque = (
  desde: string,
  hasta: string,
  extra: Partial<BloqueObservado> = {},
): BloqueObservado => ({
  desde: T(desde),
  hasta: T(hasta),
  puntos: extra.puntos ?? 10,
  kmAproximados: extra.kmAproximados ?? 0,
  saltosDescartados: extra.saltosDescartados ?? 0,
});

describe("huecosDeVentana", () => {
  it("cuenta el hueco de la orilla inicial: la franja empieza antes que el dato", () => {
    // La unidad no reportó de 06:00 a 07:30. Eso es ausencia de observación y
    // tiene que aparecer, no descontarse de la franja.
    const r = huecosDeVentana(VENTANA, [bloque("07:30", "18:00")]);

    expect(r.huecos).toBe(1);
    expect(r.huecoMayorMinutos).toBe(90);
    expect(r.minutosSinDato).toBe(90);
  });

  it("cuenta el hueco de la orilla final", () => {
    const r = huecosDeVentana(VENTANA, [bloque("06:00", "16:00")]);

    expect(r.huecos).toBe(1);
    expect(r.minutosSinDato).toBe(120);
  });

  it("cuenta los huecos de en medio y se queda con el mayor", () => {
    const r = huecosDeVentana(VENTANA, [
      bloque("06:00", "08:00"),
      bloque("08:20", "12:00"), // hueco de 20 min
      bloque("14:00", "18:00"), // hueco de 120 min
    ]);

    expect(r.huecos).toBe(2);
    expect(r.huecoMayorMinutos).toBe(120);
    expect(r.minutosSinDato).toBe(140);
  });

  it("suma las tres clases de hueco cuando conviven", () => {
    const r = huecosDeVentana(VENTANA, [
      bloque("07:00", "09:00"), // 60 min antes
      bloque("10:00", "17:00"), // 60 min en medio
    ]); // 60 min después

    expect(r.huecos).toBe(3);
    expect(r.minutosSinDato).toBe(180);
  });

  it("sin un solo punto, la franja entera es un hueco", () => {
    const r = huecosDeVentana(VENTANA, []);

    expect(r.huecos).toBe(1);
    expect(r.huecoMayorMinutos).toBe(720);
    expect(r.minutosSinDato).toBe(720);
  });

  it("una franja de duración cero no inventa huecos", () => {
    const r = huecosDeVentana({ desde: T("06:00"), hasta: T("06:00") }, []);

    expect(r.huecos).toBe(0);
    expect(r.huecoMayorMinutos).toBeNull();
    expect(r.minutosSinDato).toBe(0);
  });

  it("un bloque que cubre la franja completa no deja hueco", () => {
    const r = huecosDeVentana(VENTANA, [bloque("06:00", "18:00")]);

    expect(r.huecos).toBe(0);
    expect(r.minutosSinDato).toBe(0);
  });

  it("no depende del orden en que lleguen los bloques", () => {
    const desordenados = huecosDeVentana(VENTANA, [
      bloque("14:00", "18:00"),
      bloque("06:00", "08:00"),
      bloque("08:20", "12:00"),
    ]);
    const ordenados = huecosDeVentana(VENTANA, [
      bloque("06:00", "08:00"),
      bloque("08:20", "12:00"),
      bloque("14:00", "18:00"),
    ]);

    expect(desordenados).toEqual(ordenados);
  });
});

describe("resumirUnidadDia", () => {
  const base = {
    unitId: "unidad-1",
    fecha: "2026-07-29",
    desde: VENTANA.desde,
    hasta: VENTANA.hasta,
    equipos: 1,
  };

  it("los totales salen de los bloques, no de una cuenta aparte", () => {
    // Si el total se calculara por separado podría contradecir a los tramos que
    // dice resumir. Sumarlos de ahí lo hace imposible por construcción.
    const r = resumirUnidadDia({
      ...base,
      bloques: [
        bloque("06:00", "08:00", { puntos: 120, kmAproximados: 40.5, saltosDescartados: 1 }),
        bloque("09:00", "12:00", { puntos: 180, kmAproximados: 62.25, saltosDescartados: 2 }),
      ],
    });

    expect(r.puntos).toBe(300);
    expect(r.kmAproximados).toBeCloseTo(102.75);
    expect(r.saltosDescartados).toBe(3);
    expect(r.minutosObservados).toBe(300);
  });

  it("el primer y el último dato son los extremos observados, no la franja", () => {
    const r = resumirUnidadDia({
      ...base,
      bloques: [bloque("07:30", "09:00"), bloque("10:00", "16:45")],
    });

    expect(r.primerDato?.toISOString()).toBe(T("07:30").toISOString());
    expect(r.ultimoDato?.toISOString()).toBe(T("16:45").toISOString());
    // La franja pedida no se mueve por lo que haya reportado la unidad.
    expect(r.desde.toISOString()).toBe(T("06:00").toISOString());
    expect(r.hasta.toISOString()).toBe(T("18:00").toISOString());
  });

  it("una unidad muda se resume igual, y lo dice", () => {
    const r = resumirUnidadDia({ ...base, bloques: [] });

    expect(r.puntos).toBe(0);
    expect(r.primerDato).toBeNull();
    expect(r.ultimoDato).toBeNull();
    expect(r.kmAproximados).toBe(0);
    expect(r.huecos).toBe(1);
    expect(r.minutosSinDato).toBe(720);
    expect(r.minutosObservados).toBe(0);
  });

  it("observado y sin dato reparten la franja completa", () => {
    // La suma es la garantía de que la tira que se dibuje no miente: lo que no
    // es observación es hueco, y no hay tercer lugar donde esconder minutos.
    const r = resumirUnidadDia({
      ...base,
      bloques: [bloque("06:30", "09:00"), bloque("11:00", "17:00")],
    });

    expect(r.minutosObservados + r.minutosSinDato).toBe(720);
  });

  it("ordena los bloques aunque lleguen al revés", () => {
    const r = resumirUnidadDia({
      ...base,
      bloques: [bloque("11:00", "17:00"), bloque("06:30", "09:00")],
    });

    expect(r.bloques[0]!.desde.toISOString()).toBe(T("06:30").toISOString());
    expect(r.primerDato?.toISOString()).toBe(T("06:30").toISOString());
  });
});
