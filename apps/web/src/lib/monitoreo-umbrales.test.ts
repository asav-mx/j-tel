import { describe, expect, it } from "vitest";
import { edadSenalMinutos, SIN_SENAL_MINUTOS } from "@/lib/monitoreo-umbrales";

/**
 * El primero de los cuatro casos de "un dato correcto que miente" (Marco,
 * sección D), y el más caro: la torre marcaba **sin señal** a las unidades que
 * ya habían llegado.
 *
 * La antigüedad del último punto GPS era correcta al minuto. Lo que la volvía
 * una afirmación falsa era dónde se leía: la traza se corta al entrar a la
 * geocerca porque la geocerca es la frontera de la evidencia, así que el
 * silencio posterior es la ley funcionando. Once de catorce unidades acusaban
 * al carrier de perder señal justo donde el sistema deja de mirar a propósito.
 */

const AHORA = new Date("2026-07-31T12:00:00Z");
const HACE_30_MIN = new Date("2026-07-31T11:30:00Z");

describe("después de la geocerca no hay señal que esperar", () => {
  it("una unidad que ya llegó NUNCA tiene antigüedad de señal", () => {
    expect(
      edadSenalMinutos({
        cerrado: false,
        llego: true,
        ultimoPuntoAt: HACE_30_MIN,
        ahora: AHORA,
      }),
    ).toBeNull();
  });

  it("y por lo tanto no puede caer del lado de «sin señal»", () => {
    const edad = edadSenalMinutos({
      cerrado: false,
      llego: true,
      ultimoPuntoAt: HACE_30_MIN,
      ahora: AHORA,
    });
    // 30 min es de sobra para cruzar el umbral; lo que impide la acusación no
    // es el número, es que no haya número que comparar.
    expect(edad !== null && edad >= SIN_SENAL_MINUTOS).toBe(false);
  });

  it("un servicio ya sellado tampoco: su evidencia está congelada", () => {
    expect(
      edadSenalMinutos({
        cerrado: true,
        llego: false,
        ultimoPuntoAt: HACE_30_MIN,
        ahora: AHORA,
      }),
    ).toBeNull();
  });
});

describe("una unidad todavía en camino sí se mide", () => {
  it("da los minutos desde el último punto", () => {
    expect(
      edadSenalMinutos({
        cerrado: false,
        llego: false,
        ultimoPuntoAt: HACE_30_MIN,
        ahora: AHORA,
      }),
    ).toBe(30);
  });

  it("sin unidad no hay nada que medir", () => {
    expect(
      edadSenalMinutos({ cerrado: false, llego: false, ultimoPuntoAt: null, ahora: AHORA }),
    ).toBeNull();
  });

  it("nunca devuelve negativos, aunque llegue un punto del futuro", () => {
    expect(
      edadSenalMinutos({
        cerrado: false,
        llego: false,
        ultimoPuntoAt: new Date("2026-07-31T12:05:00Z"),
        ahora: AHORA,
      }),
    ).toBe(0);
  });
});
