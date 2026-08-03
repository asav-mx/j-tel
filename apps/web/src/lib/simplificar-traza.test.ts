import { describe, expect, it } from "vitest";
import { simplificarTraza, toleranciaParaTraza, type Punto } from "./simplificar-traza";

const p = (lat: number, lng: number): Punto => ({ lat, lng });

describe("simplificarTraza", () => {
  it("una recta con puntos intermedios queda en sus dos extremos", () => {
    const recta = Array.from({ length: 50 }, (_, i) => p(31.7 + i * 0.0001, -106.4));
    expect(simplificarTraza(recta, 10)).toHaveLength(2);
  });

  it("CONSERVA la esquina, que es lo que Douglas-Peucker aporta", () => {
    // El caso que decidió el algoritmo: una vuelta en ángulo recto. Un muestreo
    // por distancia con paso grande se la puede saltar entera y dejar una recta
    // donde hubo una desviación — justo lo que un instrumento de defensa no
    // puede perder.
    const ida = Array.from({ length: 30 }, (_, i) => p(31.7, -106.4 + i * 0.0005));
    const vuelta = Array.from({ length: 30 }, (_, i) => p(31.7 + (i + 1) * 0.0005, -106.4 + 29 * 0.0005));
    const simplificada = simplificarTraza([...ida, ...vuelta], 20);

    const esquina = ida.at(-1)!;
    expect(simplificada).toContainEqual(esquina);
    expect(simplificada.length).toBeLessThan(10);
  });

  it("no inventa puntos: todo lo que devuelve estaba en la entrada", () => {
    const traza = Array.from({ length: 200 }, (_, i) =>
      p(31.7 + Math.sin(i / 9) * 0.01, -106.4 + i * 0.0002),
    );
    for (const q of simplificarTraza(traza, 15)) expect(traza).toContainEqual(q);
  });

  it("conserva el primero y el último, siempre", () => {
    const traza = Array.from({ length: 500 }, (_, i) =>
      p(31.7 + Math.cos(i / 13) * 0.02, -106.4 + Math.sin(i / 7) * 0.02),
    );
    const s = simplificarTraza(traza, 50);
    expect(s[0]).toEqual(traza[0]);
    expect(s.at(-1)).toEqual(traza.at(-1));
  });

  it("con tolerancia 0 devuelve la traza intacta — el modo de un servicio", () => {
    const traza = Array.from({ length: 100 }, (_, i) => p(31.7 + i * 0.001, -106.4 + i * 0.001));
    expect(simplificarTraza(traza, 0)).toEqual(traza);
  });

  it("aguanta una traza larga sin desbordar la pila", () => {
    // La versión recursiva revienta justo aquí: decenas de miles de puntos casi
    // colineales, que es el caso real de una unidad estacionada reportando toda
    // la noche.
    const larga = Array.from({ length: 60_000 }, (_, i) => p(31.7 + i * 1e-7, -106.4));
    expect(() => simplificarTraza(larga, 10)).not.toThrow();
    expect(simplificarTraza(larga, 10).length).toBeLessThan(larga.length);
  });

  it("una tolerancia más grande simplifica más, nunca menos", () => {
    const traza = Array.from({ length: 300 }, (_, i) =>
      p(31.7 + Math.sin(i / 5) * 0.003, -106.4 + i * 0.0003),
    );
    const suave = simplificarTraza(traza, 5).length;
    const fuerte = simplificarTraza(traza, 60).length;
    expect(fuerte).toBeLessThanOrEqual(suave);
  });
});

describe("toleranciaParaTraza", () => {
  it("un día de una unidad se dibuja COMPLETO", () => {
    // 1 593 puntos medidos para la unidad más activa en un día.
    expect(toleranciaParaTraza(1_593)).toBe(0);
  });

  it("tres unidades por un mes sí se simplifican", () => {
    // 124 396 puntos medidos: el caso que la ficha temía.
    expect(toleranciaParaTraza(124_396)).toBeGreaterThan(0);
  });

  it("nunca baja la tolerancia al crecer la traza", () => {
    const tamaños = [100, 3_000, 3_001, 20_000, 60_000, 200_000];
    const tol = tamaños.map(toleranciaParaTraza);
    for (let i = 1; i < tol.length; i += 1) expect(tol[i]!).toBeGreaterThanOrEqual(tol[i - 1]!);
  });
});
