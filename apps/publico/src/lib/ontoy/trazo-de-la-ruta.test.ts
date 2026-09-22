import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { trazoDeLaRuta } from "./trazo-de-la-ruta";

describe("con qué fuerza se dibuja cada ruta", () => {
  it("con una prendida: ella fuerte, las demás de fondo", () => {
    expect(trazoDeLaRuta(true, true).opacidad).toBe(0.95);
    expect(trazoDeLaRuta(false, true).opacidad).toBe(0.25);
  });

  /*
   * EL DEFECTO. Sin paradas guardadas no hay favoritas, y ése es el estado de
   * todo pasajero nuevo: antes, TODAS sus rutas salían de fondo y el mapa se
   * veía sin rutas. No hay una viva a la que no tapar, así que no hay a quién
   * apagarle nada.
   */
  it("sin ninguna prendida: TODAS fuertes — es el mapa de un pasajero nuevo", () => {
    expect(trazoDeLaRuta(false, false)).toEqual(trazoDeLaRuta(true, true));
  });

  it("una línea de fondo no se toca: tocarla abriría una ruta que no se ve", () => {
    expect(trazoDeLaRuta(false, true).tocable).toBe(false);
    expect(trazoDeLaRuta(false, false).tocable).toBe(true);
  });
});

/*
 * La valla del teñido, que lee el fuente.
 *
 * `useTinteDelMapa` estaba escrito, documentado y probado, y **su único
 * llamador era `/buscar`** — una pantalla que se retiró. El mapa de Ontoy nunca
 * lo llamó: sus teselas salían a todo color en las dos pieles, y de noche
 * quedaba un mapa blanco debajo de un cascarón oscuro.
 *
 * Una prueba de la función no lo habría atrapado: la función estaba bien. Lo
 * que faltaba era la LLAMADA, así que eso es lo que se mide.
 *
 * ⚠ Y se midió mal la primera vez. La versión anterior buscaba el texto en el
 * archivo entero, así que **comentar la línea la dejaba en verde**: el defecto
 * volvía y la valla no se enteraba. Los comentarios se quitan antes de medir,
 * que es lo que la hace fallar cuando debe. Probado quitando la llamada de
 * verdad y viéndola caer.
 */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

it("el Mapa de la ciudad tiñe sus teselas — la llamada viva, no una comentada", () => {
  const fuente = readFileSync(
    new URL("../../components/ontoy/vista-mapa.tsx", import.meta.url),
    "utf8",
  );
  expect(sinComentarios(fuente)).toContain("useTinteDelMapa(");
});
