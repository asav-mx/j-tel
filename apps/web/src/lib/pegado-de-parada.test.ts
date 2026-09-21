import { describe, expect, it } from "vitest";
import { avisosAlCorregirSentido, leerSentido, pegarParadaASuSentido } from "./pegado-de-parada";

/*
 * Ida y vuelta por calles DISTINTAS, como Oasis: la ida sobre la latitud 31.720,
 * la vuelta 300 m al sur (31.7173). Tolerancia de pegado: 60 m.
 */
const IDA: Array<[number, number]> = [[-106.46, 31.72], [-106.45, 31.72]];
const VUELTA: Array<[number, number]> = [[-106.45, 31.7173], [-106.46, 31.7173]];
const TRAZADOS = [
  { sentido: "ida", coordinates: IDA },
  { sentido: "vuelta", coordinates: VUELTA },
];
const cercaDeLaVuelta = { lat: 31.7175, lon: -106.455 };
const cercaDeLaIda = { lat: 31.7202, lon: -106.455 };

describe("leerSentido — sin valor por defecto", () => {
  it("ausente es un error, no «ambos»", () => {
    expect(leerSentido({ lat: 1 }).ok).toBe(false);
  });
  it("null es «ambos», dicho a propósito; ida y vuelta pasan; lo demás no", () => {
    expect(leerSentido({ sentido: null })).toEqual({ ok: true, sentido: null });
    expect(leerSentido({ sentido: "vuelta" })).toEqual({ ok: true, sentido: "vuelta" });
    expect(leerSentido({ sentido: "ambos" }).ok).toBe(false);
  });
});

describe("pegarParadaASuSentido", () => {
  it("una de vuelta se pega a la VUELTA, no a la ida", () => {
    const r = pegarParadaASuSentido({ punto: cercaDeLaVuelta, sentido: "vuelta", trazados: TRAZADOS, toleranciaMetros: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.destino.lat).toBeCloseTo(31.7173, 4);
      expect(r.avisos).toEqual([]);
    }
  });

  it("«ambos» se pega a la ida y, si queda lejos de la vuelta, lo dice con los metros", () => {
    const r = pegarParadaASuSentido({ punto: cercaDeLaIda, sentido: null, trazados: TRAZADOS, toleranciaMetros: 60 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.destino.lat).toBeCloseTo(31.72, 4);
      expect(r.avisos.join(" ")).toMatch(/Queda a \d+ m del trazado de la vuelta .*¿de verdad sirve a los dos/);
    }
  });

  it("«ambos» cerca de los dos trazados no avisa", () => {
    const juntos = [{ sentido: "ida", coordinates: IDA }, { sentido: "vuelta", coordinates: [...IDA].reverse() }];
    const r = pegarParadaASuSentido({ punto: cercaDeLaIda, sentido: null, trazados: juntos, toleranciaMetros: 60 });
    expect(r.ok && r.avisos).toEqual([]);
  });

  it("sin trazado de ese sentido no se pega al otro: se dice", () => {
    const r = pegarParadaASuSentido({ punto: cercaDeLaVuelta, sentido: "vuelta", trazados: [TRAZADOS[0]!], toleranciaMetros: 60 });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("no tiene trazado de la vuelta");
  });

  it("soltar el pegado deja la parada donde se picó", () => {
    const r = pegarParadaASuSentido({ punto: cercaDeLaVuelta, sentido: "vuelta", trazados: TRAZADOS, toleranciaMetros: 60, sinPegar: true });
    expect(r.ok && r.destino).toEqual(cercaDeLaVuelta);
  });
});

describe("avisosAlCorregirSentido — la parada no se mueve sola", () => {
  it("una parada sobre la ida corregida a vuelta avisa que hay que moverla, con los metros", () => {
    const avisos = avisosAlCorregirSentido({ punto: { lat: 31.72, lon: -106.455 }, sentido: "vuelta", trazados: TRAZADOS, toleranciaMetros: 60 });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/Queda a \d+ m del trazado de la vuelta: muévela/);
  });
  it("corregida a un sentido cuyo trazado ya la toca, no avisa nada", () => {
    expect(avisosAlCorregirSentido({ punto: { lat: 31.72, lon: -106.455 }, sentido: "ida", trazados: TRAZADOS, toleranciaMetros: 60 })).toEqual([]);
  });
});
