import { describe, expect, it } from "vitest";
import { largoDeTrazado, pegarAlTrazado, proyectarSobreTrazado } from "./trazado.js";

/** Tramo recto de ~1 km sobre una latitud de Juárez, con un hueco largo al final. */
const RECTA: Array<[number, number]> = [
  [-106.4000, 31.7000],
  [-106.4050, 31.7000],
  [-106.4100, 31.7000],
];

describe("proyectarSobreTrazado", () => {
  it("un punto sobre el trazado se proyecta en sí mismo", () => {
    const p = proyectarSobreTrazado({ lat: 31.7, lon: -106.405 }, RECTA)!;
    expect(p.distanciaMetros).toBeLessThan(1);
    expect(p.lon).toBeCloseTo(-106.405, 5);
  });

  it("mide contra el SEGMENTO, no contra el vértice más cercano", () => {
    // A media cuadra al norte del punto medio de un tramo largo. Contra el
    // vértice más cercano daría cientos de metros; contra el segmento, ~55 m.
    const p = proyectarSobreTrazado({ lat: 31.7005, lon: -106.4025 }, RECTA)!;
    expect(p.distanciaMetros).toBeGreaterThan(40);
    expect(p.distanciaMetros).toBeLessThan(70);
    expect(p.lon).toBeCloseTo(-106.4025, 4); // cayó a media cuadra, no en el vértice
  });

  it("el avance crece a lo largo del recorrido — es lo que da la llegada", () => {
    const inicio = proyectarSobreTrazado({ lat: 31.7, lon: -106.4005 }, RECTA)!;
    const medio = proyectarSobreTrazado({ lat: 31.7, lon: -106.405 }, RECTA)!;
    const fin = proyectarSobreTrazado({ lat: 31.7, lon: -106.4095 }, RECTA)!;
    expect(inicio.avanceMetros).toBeLessThan(medio.avanceMetros);
    expect(medio.avanceMetros).toBeLessThan(fin.avanceMetros);
    expect(medio.fraccion).toBeCloseTo(0.5, 1);
  });

  it("la resta de avances es la distancia que falta para que el camión pase", () => {
    const camion = proyectarSobreTrazado({ lat: 31.7, lon: -106.4010 }, RECTA)!;
    const pasajero = proyectarSobreTrazado({ lat: 31.7, lon: -106.4060 }, RECTA)!;
    const faltan = pasajero.avanceMetros - camion.avanceMetros;
    // 0.005 grados de longitud a esta latitud ≈ 473 m
    expect(faltan).toBeGreaterThan(400);
    expect(faltan).toBeLessThan(550);
  });

  it("un punto antes del inicio se pega al inicio, sin avance negativo", () => {
    const p = proyectarSobreTrazado({ lat: 31.7, lon: -106.3900 }, RECTA)!;
    expect(p.avanceMetros).toBe(0);
    expect(p.fraccion).toBe(0);
  });

  it("un punto pasado el final se pega al final", () => {
    const p = proyectarSobreTrazado({ lat: 31.7, lon: -106.4200 }, RECTA)!;
    expect(p.fraccion).toBeCloseTo(1, 2);
  });

  it("aguanta vértices repetidos sin dividir entre cero", () => {
    const conRepetido: Array<[number, number]> = [
      [-106.4, 31.7],
      [-106.4, 31.7],
      [-106.41, 31.7],
    ];
    const p = proyectarSobreTrazado({ lat: 31.7, lon: -106.405 }, conRepetido)!;
    expect(Number.isFinite(p.avanceMetros)).toBe(true);
    expect(p.distanciaMetros).toBeLessThan(1);
  });

  it("devuelve null si el trazado no es un recorrido", () => {
    expect(proyectarSobreTrazado({ lat: 31.7, lon: -106.4 }, [[-106.4, 31.7]])).toBeNull();
  });
});

describe("pegarAlTrazado", () => {
  it("dentro de la tolerancia pega sin avisar", () => {
    const r = pegarAlTrazado({ lat: 31.70005, lon: -106.405 }, RECTA, 25)!;
    expect(r.fueraDeTolerancia).toBe(false);
    expect(r.aviso).toBeNull();
  });

  it("fuera de la tolerancia pega igual, PERO avisa y dice cuánto", () => {
    const r = pegarAlTrazado({ lat: 31.7015, lon: -106.405 }, RECTA, 25)!;
    expect(r.fueraDeTolerancia).toBe(true);
    expect(r.aviso).toContain("m del recorrido");
    expect(r.aviso).toContain("suelta el pegado");
    // Y de todos modos entrega dónde quedaría, para dibujarlo antes de confirmar.
    expect(r.proyeccion.lat).toBeCloseTo(31.7, 4);
  });

  it("la tolerancia es un parámetro: el mismo pico cambia de veredicto", () => {
    const punto = { lat: 31.7008, lon: -106.405 };
    expect(pegarAlTrazado(punto, RECTA, 25)!.fueraDeTolerancia).toBe(true);
    expect(pegarAlTrazado(punto, RECTA, 150)!.fueraDeTolerancia).toBe(false);
  });
});

describe("largoDeTrazado", () => {
  it("mide el recorrido completo", () => {
    // 0.01 grados de longitud a 31.7° ≈ 947 m
    expect(largoDeTrazado(RECTA)).toBeGreaterThan(900);
    expect(largoDeTrazado(RECTA)).toBeLessThan(1000);
  });
});
