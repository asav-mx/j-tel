import { describe, it, expect } from "vitest";
import {
  SIN_CAPACIDADES,
  describirCapacidades,
  leerCapacidades,
  type CapacidadesDeLaCamara,
} from "./camara";

/** Una pista falsa: lo que un navegador devuelve, o lo que no devuelve. */
const pista = (capacidades: unknown): MediaStreamTrack =>
  ({ getCapabilities: () => capacidades }) as unknown as MediaStreamTrack;

describe("leer lo que la cámara puede", () => {
  it("ve el enfoque continuo, el punto de enfoque y el zoom", () => {
    const c = leerCapacidades(
      pista({ focusMode: ["manual", "continuous"], pointsOfInterest: {}, zoom: { min: 1, max: 8 } }),
    );
    expect(c).toEqual({
      enfoqueContinuo: true,
      puntoDeEnfoque: true,
      zoom: { min: 1, max: 8, step: 0.1 },
    });
  });

  /*
   * El Safari de un iPhone no expone casi nada de esto. El lector tiene que
   * seguir de pie: aquí se comprueba que «no sé» no sea «me caigo».
   */
  it("un aparato que no dice nada no rompe nada", () => {
    expect(leerCapacidades(pista({}))).toEqual(SIN_CAPACIDADES);
    expect(leerCapacidades(pista(undefined))).toEqual(SIN_CAPACIDADES);
    expect(leerCapacidades({} as MediaStreamTrack)).toEqual(SIN_CAPACIDADES);
  });

  it("una pista que avienta al preguntarle tampoco", () => {
    const enojada = {
      getCapabilities: () => {
        throw new Error("no");
      },
    } as unknown as MediaStreamTrack;
    expect(leerCapacidades(enojada)).toEqual(SIN_CAPACIDADES);
  });

  it("un zoom sin rango de verdad no cuenta como zoom", () => {
    expect(leerCapacidades(pista({ zoom: { min: 1, max: 1 } })).zoom).toBeNull();
    expect(leerCapacidades(pista({ zoom: {} })).zoom).toBeNull();
  });

  it("enfoque manual a secas no es enfoque continuo", () => {
    expect(leerCapacidades(pista({ focusMode: ["manual"] })).enfoqueContinuo).toBe(false);
  });
});

describe("lo que el diagnóstico dice de la cámara", () => {
  /* La línea que ASAV va a copiar y mandar cuando algo no lea. */
  it("dice con qué cuenta el aparato", () => {
    const c: CapacidadesDeLaCamara = {
      enfoqueContinuo: true,
      puntoDeEnfoque: true,
      zoom: { min: 1, max: 8, step: 0.1 },
    };
    expect(describirCapacidades(c, 2)).toBe("enfoque: continuo+toque · zoom 1–8× en 2×");
  });

  it("y dice también cuando NO cuenta con nada", () => {
    expect(describirCapacidades(SIN_CAPACIDADES, null)).toBe("enfoque: sin control · sin zoom");
  });
});
