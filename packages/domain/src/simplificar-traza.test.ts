import { describe, expect, it } from "vitest";
import {
  esGradoDeTrazo,
  gradoParaVentana,
  simplificarTraza,
  TOLERANCIA_POR_GRADO,
  type Punto,
} from "./simplificar-traza.js";

/* Un plano en metros alrededor de Juárez, para pensar las pruebas en calles y no en grados. */
const ORIGEN = { lat: 31.72, lng: -106.45 };
const M_POR_GRADO_LNG = 111_320 * Math.cos((ORIGEN.lat * Math.PI) / 180);
const m = (este: number, norte: number): Punto => ({
  lat: ORIGEN.lat + norte / 111_320,
  lng: ORIGEN.lng + este / M_POR_GRADO_LNG,
});

/** Puntos cada `paso` metros de `a` a `b`, sin repetir `a`. */
function calle(a: [number, number], b: [number, number], paso = 50): Punto[] {
  const largo = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(largo / paso));
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / n;
    return m(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
  });
}

const TOLERANCIAS = [0.5, 3, ...TOLERANCIA_POR_GRADO.slice(1), 250, 10_000, 1e7];

/** Traza sinuosa determinista: 600 puntos que dan vueltas y cambian de rumbo. */
const SINUOSA: Punto[] = Array.from({ length: 600 }, (_, i) =>
  m(i * 12 + Math.sin(i / 7) * 90, Math.cos(i / 11) * 140 + Math.sin(i / 3) * 6),
);

describe("simplificarTraza · sin opciones, como la usa el Workbench", () => {
  it("una recta queda en sus dos extremos", () => {
    expect(simplificarTraza(calle([0, 0], [3000, 0]), 10)).toHaveLength(2);
  });

  it("tolerancia cero o traza de dos puntos no simplifica", () => {
    const t = calle([0, 0], [500, 0]);
    expect(simplificarTraza(t, 0)).toBe(t);
    expect(simplificarTraza(t.slice(0, 2), 40)).toHaveLength(2);
  });
});

describe("simplificarTraza · los intocables sobreviven cualquier tolerancia (regla 9)", () => {
  const intocables = new Set([1, 37, 74, 111, 222, 333, 334, 598]);

  for (const tol of TOLERANCIAS) {
    it(`tolerancia ${tol} m: todos los intocables, las puntas, en orden y sin inventar`, () => {
      const salida = simplificarTraza(SINUOSA, tol, {
        intocable: (i) => intocables.has(i),
        conservarVueltas: true,
      });
      const indices = salida.map((q) => SINUOSA.indexOf(q));
      expect(indices).not.toContain(-1);
      expect(indices).toEqual([...indices].sort((a, b) => a - b));
      expect(indices[0]).toBe(0);
      expect(indices.at(-1)).toBe(SINUOSA.length - 1);
      for (const i of intocables) expect(indices).toContain(i);
    });
  }

  it("la prueba muerde: sin marcarlos, una tolerancia grande sí los quita", () => {
    const salida = simplificarTraza(SINUOSA, 10_000);
    const indices = salida.map((q) => SINUOSA.indexOf(q));
    expect([...intocables].some((i) => !indices.includes(i))).toBe(true);
  });

  it("un intocable a media recta —una entrada a geocerca en plena avenida— se queda", () => {
    const recta = calle([0, 0], [4000, 0]);
    const salida = simplificarTraza(recta, 40, { intocable: (i) => i === 31 });
    expect(salida).toEqual([recta[0], recta[31], recta.at(-1)]);
  });
});

describe("simplificarTraza · una vuelta cerrada no se pierde", () => {
  it("vuelta a la manzana que regresa al punto de salida: queda en todos los grados", () => {
    // 300 m por lado, empieza y termina en la misma esquina.
    const vuelta = [m(0, 0), ...calle([0, 0], [300, 0]), ...calle([300, 0], [300, 300]), ...calle([300, 300], [0, 300]), ...calle([0, 300], [0, 0])];
    for (const tol of TOLERANCIA_POR_GRADO) {
      const salida = simplificarTraza(vuelta, tol, { conservarVueltas: true });
      const masLejos = Math.max(...salida.map((q) => Math.hypot((q.lng - ORIGEN.lng) * M_POR_GRADO_LNG, (q.lat - ORIGEN.lat) * 111_320)));
      expect(salida.length).toBeGreaterThanOrEqual(4);
      expect(masLejos).toBeGreaterThan(400); // llega a la esquina opuesta (≈424 m)
    }
  });

  it("regreso por la misma calle: ida 3 km, vuelta 2 km, sigue 4 km — el dibujo conserva las dos vueltas", () => {
    const traza = [m(0, 0), ...calle([0, 0], [3000, 0]), ...calle([3000, 0], [1000, 0]), ...calle([1000, 0], [5000, 0])];
    for (const tol of TOLERANCIA_POR_GRADO.slice(1)) {
      const con = simplificarTraza(traza, tol, { conservarVueltas: true });
      const este = con.map((q) => Math.round((q.lng - ORIGEN.lng) * M_POR_GRADO_LNG));
      expect(este).toEqual([0, 3000, 1000, 5000]);
    }
    // Sin la opción, Douglas-Peucker a secas las borra: todos los puntos caen sobre la recta.
    expect(simplificarTraza(traza, 40)).toHaveLength(2);
  });

  it("el temblor del GPS en una parada no se toma por vuelta", () => {
    const quieto = Array.from({ length: 30 }, (_, i) => m(Math.sin(i) * 2, Math.cos(i * 1.3) * 2));
    const traza = [...calle([-2000, 0], [0, 0]), ...quieto, ...calle([0, 0], [2000, 0])];
    expect(simplificarTraza(traza, 8, { conservarVueltas: true }).length).toBeLessThanOrEqual(4);
  });
});

describe("gradoParaVentana · el grado se sabe antes de leer puntos", () => {
  const ventana = (horas: number) => ({
    desde: new Date("2026-09-01T06:00:00Z"),
    hasta: new Date(new Date("2026-09-01T06:00:00Z").getTime() + horas * 3_600_000),
  });

  it("con la cadencia medida (un punto por minuto) y los umbrales del Workbench", () => {
    expect(gradoParaVentana(ventana(0.1))).toBe(0); // la brocha: detalle completo
    expect(gradoParaVentana(ventana(24))).toBe(0); // un día
    expect(gradoParaVentana(ventana(50))).toBe(0); // 3 000 puntos, el borde
    expect(gradoParaVentana(ventana(50.1))).toBe(1);
    expect(gradoParaVentana(ventana(24 * 7))).toBe(1); // últimos 7 días
    expect(gradoParaVentana(ventana(24 * 31))).toBe(2); // este mes
    expect(gradoParaVentana(ventana(24 * 60))).toBe(3);
  });

  it("sólo hay cuatro grados", () => {
    expect([0, 1, 2, 3].every(esGradoDeTrazo)).toBe(true);
    expect([4, -1, 1.5, Number.NaN].some(esGradoDeTrazo)).toBe(false);
  });
});
