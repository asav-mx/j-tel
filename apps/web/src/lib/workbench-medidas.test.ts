import { describe, expect, it } from "vitest";
import {
  huecosDeSenal,
  kilometros,
  ordenarPorTiempo,
  paradas,
  partirEnHuecos,
  type PuntoTraza,
} from "./workbench-medidas";

const T0 = new Date("2026-08-02T11:00:00.000Z");
const min = (n: number) => new Date(T0.getTime() + n * 60_000);

const p = (minuto: number, speed: number, lat = 31.7, lng = -106.4): PuntoTraza => ({
  lat,
  lng,
  at: min(minuto),
  speed,
});

describe("huecosDeSenal", () => {
  it("no inventa un hueco donde la cadencia es la normal", () => {
    // Cadencia real medida: un punto por minuto.
    const traza = Array.from({ length: 30 }, (_, i) => p(i, 40));
    expect(huecosDeSenal(traza, 15)).toHaveLength(0);
  });

  it("marca el hueco con sus DOS extremos, no solo dónde se perdió", () => {
    const traza = [p(0, 40, 31.70, -106.40), p(45, 40, 31.75, -106.45)];
    const [h] = huecosDeSenal(traza, 15);
    expect(h?.minutos).toBe(45);
    expect(h?.lat).toBe(31.7);
    expect(h?.latFin).toBe(31.75);
  });

  it("el umbral es exclusivo: exactamente el umbral no es hueco", () => {
    expect(huecosDeSenal([p(0, 40), p(15, 40)], 15)).toHaveLength(0);
    expect(huecosDeSenal([p(0, 40), p(16, 40)], 15)).toHaveLength(1);
  });
});

describe("paradas", () => {
  const opciones = { minMinutos: 5, umbralHuecoMinutos: 15 };

  it("una corrida en cero más larga que el umbral es una parada", () => {
    const traza = [p(0, 30), ...Array.from({ length: 12 }, (_, i) => p(1 + i, 0)), p(20, 30)];
    const r = paradas(traza, opciones);
    expect(r).toHaveLength(1);
    expect(r[0]!.minutos).toBe(11);
  });

  it("un semáforo NO es una parada — para eso existe el umbral", () => {
    const traza = [p(0, 30), p(1, 0), p(2, 0), p(3, 30)];
    expect(paradas(traza, opciones)).toHaveLength(0);
  });

  it("un hueco de señal entre dos ceros CORTA la parada", () => {
    // El caso que importa: sin el corte, esto se dibujaría como una parada de
    // 120 minutos que nadie observó. El equipo se calló; no se sabe si siguió
    // quieto, y suponerlo sería inventar evidencia con forma de medición.
    const traza = [
      ...Array.from({ length: 8 }, (_, i) => p(i, 0)),
      ...Array.from({ length: 8 }, (_, i) => p(120 + i, 0)),
    ];
    const r = paradas(traza, opciones);
    expect(r).toHaveLength(2);
    expect(r[0]!.minutos).toBe(7);
    expect(r[1]!.minutos).toBe(7);
  });

  it("el umbral se mueve, y mueve el resultado — es configurable a propósito", () => {
    const traza = [p(0, 30), ...Array.from({ length: 4 }, (_, i) => p(1 + i, 0)), p(10, 30)];
    expect(paradas(traza, { ...opciones, minMinutos: 5 })).toHaveLength(0);
    expect(paradas(traza, { ...opciones, minMinutos: 3 })).toHaveLength(1);
  });

  it("una traza entera quieta da UNA parada, no una por punto", () => {
    // La flota estacionada de madrugada: 99.8% de los puntos en cero. Es el
    // caso que sacó al "tiempo detenido" de la pantalla, y aquí solo produce
    // un lugar con duración.
    const traza = Array.from({ length: 300 }, (_, i) => p(i, 0));
    const r = paradas(traza, opciones);
    expect(r).toHaveLength(1);
    expect(r[0]!.minutos).toBe(299);
  });

  it("nunca devuelve una parada que empiece después de terminar", () => {
    const traza = Array.from({ length: 60 }, (_, i) => p(i, i % 7 === 0 ? 25 : 0));
    for (const r of paradas(traza, opciones)) {
      expect(r.hasta.getTime()).toBeGreaterThanOrEqual(r.desde.getTime());
    }
  });
});

describe("partirEnHuecos", () => {
  it("una traza continua es UN tramo", () => {
    const traza = Array.from({ length: 40 }, (_, i) => p(i, 30));
    expect(partirEnHuecos(traza, 15)).toHaveLength(1);
  });

  it("corta en el hueco: la recta que lo cruzaría no se dibuja", () => {
    // El caso real: un rango de varios días. Entre el último punto de una
    // noche y el primero de la mañana siguiente no hay recorrido observado, y
    // una polilínea continua dibujaría una diagonal limpia cruzando la ciudad
    // con el mismo brillo que la evidencia de verdad.
    const traza = [
      ...Array.from({ length: 10 }, (_, i) => p(i, 30, 31.70)),
      ...Array.from({ length: 10 }, (_, i) => p(600 + i, 30, 31.85)),
    ];
    const tramos = partirEnHuecos(traza, 15);
    expect(tramos).toHaveLength(2);
    expect(tramos[0]).toHaveLength(10);
    expect(tramos[1]).toHaveLength(10);
  });

  it("no pierde ni duplica un solo punto", () => {
    const traza = Array.from({ length: 100 }, (_, i) => p(i * (i % 11 === 0 ? 40 : 1), 20));
    const tramos = partirEnHuecos(traza, 15);
    expect(tramos.reduce((s, t) => s + t.length, 0)).toBe(traza.length);
  });

  it("una traza vacía no produce un tramo vacío", () => {
    expect(partirEnHuecos([], 15)).toEqual([]);
  });

  it("usa el MISMO umbral que los huecos: tantos cortes como huecos", () => {
    const traza = [p(0, 20), p(1, 20), p(60, 20), p(61, 20), p(200, 20)];
    expect(partirEnHuecos(traza, 15)).toHaveLength(huecosDeSenal(traza, 15).length + 1);
  });
});

describe("kilometros", () => {
  it("descarta el salto del equipo y lo REPORTA, no lo esconde", () => {
    // Un punto en Juárez y el siguiente a medio país un minuto después: eso no
    // es movimiento, es el equipo. Sumarlo daría un recorrido imposible.
    const traza: PuntoTraza[] = [
      { lat: 31.7, lng: -106.4, at: min(0), speed: 40 },
      { lat: 19.4, lng: -99.1, at: min(1), speed: 40 },
      { lat: 19.4, lng: -99.2, at: min(30), speed: 40 },
    ];
    const r = kilometros(traza);
    expect(r.saltosDescartados).toBe(1);
    expect(r.km).toBeLessThan(20);
  });

  it("dos lecturas del mismo instante no suman ni cuentan como salto", () => {
    const traza: PuntoTraza[] = [
      { lat: 31.7, lng: -106.4, at: min(0), speed: 0 },
      { lat: 31.9, lng: -106.6, at: min(0), speed: 0 },
    ];
    expect(kilometros(traza)).toEqual({ km: 0, saltosDescartados: 0 });
  });

  it("un tramo conocido se mide donde debe: ~11.1 km por 0.1° de latitud", () => {
    const traza: PuntoTraza[] = [
      { lat: 31.7, lng: -106.4, at: min(0), speed: 60 },
      { lat: 31.8, lng: -106.4, at: min(30), speed: 60 },
    ];
    expect(kilometros(traza).km).toBeCloseTo(11.1, 1);
  });
});

describe("ordenarPorTiempo", () => {
  it("no muta la entrada", () => {
    const traza = [p(5, 0), p(1, 0)];
    const copia = [...traza];
    ordenarPorTiempo(traza);
    expect(traza).toEqual(copia);
  });
});
