import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  numerarParadasDelSentido,
  numeroDeParadaEnPalabras,
  type ParadaNumerable,
} from "./numero-de-parada.js";

/*
 * Una avenida recta de oeste a este, ~1.1 km. La ida va hacia el este; la
 * vuelta es la misma calle al revés. Trazados en `[lon, lat]`, como el KML.
 */
const LAT = 31.7;
const IDA: Array<[number, number]> = [
  [-106.5, LAT],
  [-106.49, LAT],
];
const VUELTA: Array<[number, number]> = [
  [-106.49, LAT],
  [-106.5, LAT],
];
const CORREDOR = 60;

const parada = (id: string, lon: number, sentido: ParadaNumerable["sentido"], orden: number): ParadaNumerable => ({
  id,
  sentido,
  orden,
  lat: LAT,
  lon,
});

describe("el número de una parada en su sentido", () => {
  it("cuenta en el orden en que pasa el camión, no en el que se capturaron", () => {
    const paradas = [
      parada("c", -106.492, "ida", 1),
      parada("a", -106.498, "ida", 2),
      parada("b", -106.495, "ida", 3),
    ];
    const n = numerarParadasDelSentido(paradas, "ida", IDA, CORREDOR);
    expect(n.get("a")).toEqual({ numero: 1, de: 3 });
    expect(n.get("b")).toEqual({ numero: 2, de: 3 });
    expect(n.get("c")).toEqual({ numero: 3, de: 3 });
  });

  it("una parada de los dos sentidos cuenta en los dos, y de vuelta al revés", () => {
    const paradas = [
      parada("oeste", -106.498, null, 1),
      parada("medio", -106.495, null, 2),
      parada("este", -106.492, null, 3),
    ];
    const ida = numerarParadasDelSentido(paradas, "ida", IDA, CORREDOR);
    const vuelta = numerarParadasDelSentido(paradas, "vuelta", VUELTA, CORREDOR);
    expect(ida.get("oeste")?.numero).toBe(1);
    expect(vuelta.get("oeste")?.numero).toBe(3);
    expect(vuelta.get("este")?.numero).toBe(1);
  });

  it("las del otro sentido no cuentan ni en el total", () => {
    const paradas = [
      parada("a", -106.498, "ida", 1),
      parada("x", -106.496, "vuelta", 2),
      parada("b", -106.494, "ida", 3),
    ];
    const n = numerarParadasDelSentido(paradas, "ida", IDA, CORREDOR);
    expect(n.has("x")).toBe(false);
    expect(n.get("b")).toEqual({ numero: 2, de: 2 });
  });

  it("la que no cae en el corredor no tiene número: la lista tampoco la enseña", () => {
    const lejos: ParadaNumerable = { id: "lejos", sentido: "ida", orden: 2, lat: LAT + 0.01, lon: -106.495 };
    const paradas = [parada("a", -106.498, "ida", 1), lejos, parada("b", -106.492, "ida", 3)];
    const n = numerarParadasDelSentido(paradas, "ida", IDA, CORREDOR);
    expect(n.has("lejos")).toBe(false);
    expect(n.get("b")).toEqual({ numero: 2, de: 2 });
  });

  it("insertar una parada corre los números de las que siguen — por eso no se imprime", () => {
    const antes = [parada("a", -106.498, "ida", 1), parada("b", -106.492, "ida", 2)];
    const despues = [...antes, parada("nueva", -106.495, "ida", 3)];
    expect(numerarParadasDelSentido(antes, "ida", IDA, CORREDOR).get("b")).toEqual({ numero: 2, de: 2 });
    expect(numerarParadasDelSentido(despues, "ida", IDA, CORREDOR).get("b")).toEqual({ numero: 3, de: 3 });
  });

  it("dos en el mismo metro se desempatan por su orden, siempre igual", () => {
    const paradas = [parada("segunda", -106.495, "ida", 5), parada("primera", -106.495, "ida", 4)];
    const n = numerarParadasDelSentido(paradas, "ida", IDA, CORREDOR);
    expect(n.get("primera")?.numero).toBe(1);
    expect(n.get("segunda")?.numero).toBe(2);
  });

  it("sin trazado no hay orden que afirmar", () => {
    const paradas = [parada("a", -106.498, "ida", 1)];
    expect(numerarParadasDelSentido(paradas, "ida", undefined, CORREDOR).size).toBe(0);
    expect(numerarParadasDelSentido(paradas, "ida", [[-106.5, LAT]], CORREDOR).size).toBe(0);
  });

  it("se dice «7 de 18»", () => {
    expect(numeroDeParadaEnPalabras({ numero: 7, de: 18 })).toBe("7 de 18");
  });
});

/**
 * **La valla: el número no llega a lo impreso.** Un letrero atornillado a un
 * poste no se corrige cuando se inserta una parada; lo que se imprime es el
 * `qr_slug`. Si esta prueba se cae, alguien está a punto de imprimir un número
 * que mañana va a mentir.
 */
describe("numerarParadasDelSentido — la valla: nada impreso lo usa", () => {
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const CASA = "apps/web/src/components/casa";
  const LETREROS = "apps/web/src/app/casa/jstaff/circuitos/[id]/letreros";

  const impresos = [
    ...readdirSync(path.join(REPO, CASA))
      .filter((f) => /^(lamina|letrero|.*impreso).*\.tsx$/.test(f))
      .map((f) => `${CASA}/${f}`),
    ...readdirSync(path.join(REPO, LETREROS)).map((f) => `${LETREROS}/${f}`),
  ];

  it("encuentra los impresos (si no, la valla no vigila nada)", () => {
    expect(impresos).toEqual(
      expect.arrayContaining([`${CASA}/lamina-de-parada.tsx`, `${CASA}/letrero-de-parada.tsx`, `${LETREROS}/page.tsx`]),
    );
  });

  it.each(impresos)("%s no numera paradas", (archivo) => {
    const texto = readFileSync(path.join(REPO, archivo), "utf8");
    expect(texto).not.toMatch(/numerarParadasDelSentido|numeroDeParadaEnPalabras|numero-de-parada/);
  });
});
