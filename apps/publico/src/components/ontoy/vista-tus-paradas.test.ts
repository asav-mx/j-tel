import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **«Tus paradas».**
 *
 * ## Qué NO prueba
 *
 * **No arrastra nada.** El gesto se probó en el navegador —con el dedo y con
 * las flechas— y se mira. Lo que se cerca aquí son **los dos defectos que ya
 * costaron**, porque los dos compilaban perfecto y ninguna prueba unitaria los
 * veía.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const vista = readFileSync(path.join(AQUI, "vista-tus-paradas.tsx"), "utf8");
const guardadas = readFileSync(path.join(AQUI, "../../lib/ontoy/paradas-guardadas.ts"), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("los dos defectos que ya costaron", () => {
  it("`quitar` NO lee su respuesta desde dentro de un actualizador de estado", () => {
    /*
     * La primera versión sacaba la parada quitada desde dentro de
     * `setIds(antes => …)` y la devolvía después. **Siempre devolvía `null`**:
     * el actualizador es una función que React corre cuando quiere. El botón
     * funcionaba —la parada se iba— y el «Deshacer» no aparecía **nunca**.
     *
     * Se cerca la forma, no el resultado, porque el resultado sólo se ve
     * corriendo React: si alguien vuelve a envolver la lectura en un
     * actualizador, esto se cae.
     */
    const cuerpo = sinComentarios(guardadas);
    const i = cuerpo.indexOf("const quitar =");
    const j = cuerpo.indexOf("const reponer =");
    expect(i).toBeGreaterThan(0);
    const bloque = cuerpo.slice(i, j);
    expect(bloque, "leer desde dentro del actualizador devuelve null").not.toMatch(/setIds\(\s*\(/);
    expect(bloque, "se lee de la lista de ahorita").toContain("ids.findIndex");
  });

  it("el arrastre escucha en la VENTANA, no en el asa", () => {
    /*
     * Al reordenar, React **mueve el nodo** del renglón. Con los escuchas
     * colgados del asa, ese movimiento se llevaba la captura del puntero y el
     * `pointerup` no volvía nunca: quedaba «Arrastrando…» pegado después de
     * soltar, y sólo se quitaba recargando.
     */
    const cuerpo = sinComentarios(vista);
    expect(cuerpo).toContain('window.addEventListener("pointerup"');
    expect(cuerpo, "colgarlos del asa los pierde al reordenar").not.toMatch(/asa\.addEventListener/);
    expect(cuerpo, "la captura del puntero se pierde igual").not.toContain("setPointerCapture");
  });
});

describe("el nombre de una parada no se inventa", () => {
  it("mientras la lista no llega, se dice que se está preguntando", () => {
    /*
     * El teléfono guarda el slug, no el nombre. La primera versión ponía «Tu
     * parada» de relleno, y eso se lee como el nombre de verdad — §E del Marco:
     * completar un hueco para que la pantalla se vea entera.
     */
    const cuerpo = sinComentarios(vista);
    expect(cuerpo).toContain('"Preguntando…"');
    expect(cuerpo, "«Tu parada» se lee como un nombre").not.toContain('?? "Tu parada"');
  });
});

describe("el orden y la salida", () => {
  it("se puede reordenar con el TECLADO, no sólo arrastrando", () => {
    /*
     * Un control que sólo se arrastra deja fuera a quien no puede hacer ese
     * gesto — y además no se puede probar sin un dedo.
     */
    const cuerpo = sinComentarios(vista);
    expect(cuerpo).toContain('e.key === "ArrowUp"');
    expect(cuerpo).toContain('e.key === "ArrowDown"');
  });

  it("tiene su salida, que es lo que la 8.10 exige", () => {
    expect(sinComentarios(vista)).toContain('aria-label="Volver a Inicio"');
  });

  it("no es un quinto lugar de la barra", () => {
    /*
     * La barra tiene cuatro lugares y eso es ley (8.8). Ésta cuelga de Inicio,
     * como la ruta abierta cuelga del Mapa.
     */
    const shell = readFileSync(path.join(AQUI, "ontoy.tsx"), "utf8");
    expect(sinComentarios(shell)).toContain('lugar === "inicio" && verTusParadas');
  });
});
