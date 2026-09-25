import { expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * La valla de **la piel del mapa**, que lee el fuente.
 *
 * ## De dónde viene, porque el defecto es el mismo con otra ropa
 *
 * Esta valla nació como «la valla del teñido». `useTinteDelMapa` estaba escrito,
 * documentado y probado, y **su único llamador era `/buscar`** — una pantalla
 * que se retiró. El mapa de Ontoy nunca lo llamó: sus teselas salían a todo
 * color en las dos pieles, y de noche quedaba un mapa blanco debajo de un
 * cascarón oscuro.
 *
 * Una prueba de la función no lo habría atrapado: **la función estaba bien. Lo
 * que faltaba era la LLAMADA**, así que eso es lo que se mide.
 *
 * ⚠ Y se midió mal la primera vez. La versión anterior buscaba el texto en el
 * archivo entero, así que **comentar la línea la dejaba en verde**: el defecto
 * volvía y la valla no se enteraba. Los comentarios se quitan antes de medir.
 *
 * ## 25-sep-2026: el teñido se fue, la valla se queda
 *
 * El fondo dejó de ser una imagen ajena que se filtraba y pasó a **dibujarse**
 * con los colores de la piel. `useTinteDelMapa` ya no se llama — y el caso que
 * exigía esa llamada **se cayó**, que era su trabajo.
 *
 * Lo que NO cambió es el defecto: que el mapa se dibuje con la piel equivocada
 * porque falta la llamada que se la pone. Por eso el archivo no se borró; se
 * reescribió midiendo las dos llamadas nuevas, y una tercera cosa que antes no
 * podía pasar.
 */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const vistaMapa = () =>
  sinComentarios(
    readFileSync(new URL("../../components/ontoy/vista-mapa.tsx", import.meta.url), "utf8"),
  );

it("el Mapa de la ciudad crea su fondo — la llamada viva, no una comentada", () => {
  expect(vistaMapa()).toContain("crearCapaDeFondo(");
});

it("y lo vuelve a vestir cuando cambia la piel", () => {
  /*
   * Sin esto el mapa nace con la piel que tocaba al abrir y **se queda con
   * ella**: cambiar a oscuro dejaría la ciudad en banqueta debajo de un cascarón
   * azul noche. Es el mismo defecto de siempre, un escalón más arriba — antes
   * faltaba poner el filtro, ahora faltaría volver a pintar.
   */
  expect(vistaMapa()).toContain(".vestir(");
});

it("y NO se le aplica encima el filtro viejo, que lo dejaría invertido", () => {
  /*
   * `tinte-del-mapa.ts` sigue en el repo a propósito: es el plan B declarado
   * mientras el mapa propio no haya rodado en la calle. Pero **filtrar un mapa
   * que ya se dibujó con su piel lo tiñe dos veces**: de noche, `invert(1)`
   * sobre azul noche devuelve un mapa amarillento, y ninguna prueba de colores
   * lo vería — los tokens seguirían siendo los correctos; lo que mentiría es la
   * pantalla.
   */
  expect(vistaMapa()).not.toContain("useTinteDelMapa(");
});
