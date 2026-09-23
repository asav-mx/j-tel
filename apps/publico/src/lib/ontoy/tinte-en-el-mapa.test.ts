import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
 * que es lo que la hace fallar cuando debe. Probada quitando la llamada de
 * verdad y viéndola caer.
 *
 * ✎ **22-sep-2026:** este archivo cubría además `trazoDeLaRuta`, la regla de
 * con qué fuerza se dibujaba cada ruta. Esa regla **la reemplazó la tira de
 * chips**: ahora una ruta se dibuja o no se dibuja, sin tonos a medias, y lo
 * que protegía —que un pasajero sin favoritas viera sus rutas— lo garantiza el
 * estado inicial, probado en `tira-de-rutas.test.ts`.
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
