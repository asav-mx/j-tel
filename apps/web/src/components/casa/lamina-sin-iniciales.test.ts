import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TinoDeLaLamina } from "./ontoy-impreso";
import { LaminaDeParada } from "./lamina-de-parada";
import { LetreroDeParada } from "./letrero-de-parada";

/*
 * **Nunca iniciales en lo impreso** (ASAV, 26-sep-2026, antes de imprimir las 18
 * láminas). La placa carbón es sólo para identificadores cortos que existen —el
 * número de la ruta o de la unidad—; sin número, la ruta va con su franja de
 * color y su nombre como texto.
 *
 * Se prueba DIBUJANDO las tres piezas —Páris, la lámina de 40 × 60 y el letrero
 * de carta— con la ruta de las láminas, que no trae número, y con una que sí.
 */
const SIN_NUMERO = { nombre: "Oasis – Parroquia Santa Teresa de Jesús", colorHex: "#4F7FD8" };
const CON_NUMERO = { nombre: "Ruta 51 · Centro–Tecnológico", colorHex: "#4F7FD8" };
const PARADA = { nombre: "Av. Tecnológico y Calle 16", qrSlug: "oasis-centro-7" };

const dibujar = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
/** Todo el texto que queda dentro de una placa carbón o una chapa, en el orden en que sale. */
const enPlacas = (html: string) =>
  [
    ...html.matchAll(/<text[^>]*>([^<]*)<\/text>/g),
    ...html.matchAll(/class="(?:letrero-placa|lamina-chapa-texto)"[^>]*>([^<]*)</g),
  ].map((m) => m[1]);

describe("Páris, en lo impreso", () => {
  it("sin número de ruta, va sin placa: nada de «OJ» en el pecho", () => {
    const html = dibujar(createElement(TinoDeLaLamina, { ruta: SIN_NUMERO.nombre, colorHex: SIN_NUMERO.colorHex }));
    expect(enPlacas(html)).toEqual([]);
    expect(html).not.toContain("<rect x=\"31\" y=\"70\"");
    // El lector de pantalla sigue diciendo la ruta entera.
    expect(html).toContain('aria-label="Parada de la ruta Oasis – Parroquia Santa Teresa de Jesús"');
  });

  it("con número, su placa lleva el número", () => {
    const html = dibujar(createElement(TinoDeLaLamina, { ruta: CON_NUMERO.nombre, colorHex: CON_NUMERO.colorHex }));
    expect(enPlacas(html)).toEqual(["51"]);
  });
});

describe("la lámina de 40 × 60", () => {
  it("sin número: ni placa ni chapa; la franja de color y el nombre como texto", () => {
    const html = dibujar(createElement(LaminaDeParada, { parada: PARADA, ruta: SIN_NUMERO }));
    expect(enPlacas(html)).toEqual([]);
    expect(html).toContain('class="lamina-franja"');
    expect(html).toContain(`<p class="lamina-ruta-nombre">${SIN_NUMERO.nombre}</p>`);
    expect(html).not.toMatch(/>OJ<|>OC<|>OP</);
  });

  it("con número: la placa de Páris y la chapa llevan el número, y el nombre va al lado", () => {
    const html = dibujar(createElement(LaminaDeParada, { parada: PARADA, ruta: CON_NUMERO }));
    expect(enPlacas(html)).toEqual(["51", "51"]);
    expect(html).not.toContain('class="lamina-franja"');
    expect(html).toContain(`<p class="lamina-ruta-nombre">${CON_NUMERO.nombre}</p>`);
  });
});

describe("el letrero de carta", () => {
  it("sin número: la franja de color y el nombre como texto, no el nombre dentro de una placa carbón", () => {
    const html = dibujar(createElement(LetreroDeParada, { parada: PARADA, ruta: SIN_NUMERO }));
    expect(enPlacas(html)).toEqual([]);
    expect(html).toContain('class="letrero-franja"');
    expect(html).toContain(`<span class="letrero-ruta-nombre">${SIN_NUMERO.nombre}</span>`);
  });

  it("con número: la placa de Páris y la de la ruta llevan sólo el número", () => {
    const html = dibujar(createElement(LetreroDeParada, { parada: PARADA, ruta: CON_NUMERO }));
    expect(enPlacas(html)).toEqual(["51", "51"]);
    expect(html).toContain(`<span class="letrero-ruta-nombre">${CON_NUMERO.nombre}</span>`);
  });
});
