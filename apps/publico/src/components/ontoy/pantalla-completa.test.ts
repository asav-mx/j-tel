import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **LAS PANTALLAS DE ESTADO COMPLETO.**
 *
 * ## Qué NO prueba
 *
 * **No prueba que se vean bien** — eso se mira. Lo que se cerca aquí son dos
 * cosas que se deshacen solas: que haya **una** salida, y que esa salida lleve a
 * donde dice.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(AQUI, "..", "..", "app");
const pieza = readFileSync(path.join(AQUI, "pantalla-completa.tsx"), "utf8");

/** Cada `not-found.tsx` de la app, esté donde esté. */
function noEncontrados(dir: string): Array<[string, string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return noEncontrados(p);
    return e.name === "not-found.tsx" ? [[path.relative(APP, p), readFileSync(p, "utf8")] as [string, string]] : [];
  });
}

describe("una salida, y una sola (8.10)", () => {
  it("la pieza recibe UN botón, no una lista", () => {
    /*
     * Una pantalla completa aparece cuando el pasajero ya se topó con algo que
     * no esperaba. Dos salidas ahí son una decisión más que tomar. Si hiciera
     * falta una segunda, lo que falta no es un botón: es que esta pantalla no
     * debería ser completa.
     */
    expect(pieza).toContain("boton: { texto: string; a: string }");
    expect(pieza, "una lista de botones abre la puerta al menú").not.toMatch(/botones\s*:/);
  });

  it("todas las pantallas de no-encontrado usan la pieza", () => {
    const pantallas = noEncontrados(APP);
    expect(pantallas.length, "hay pantallas que revisar").toBeGreaterThanOrEqual(2);
    for (const [archivo, t] of pantallas) {
      expect(t, `${archivo} tiene que usar PantallaCompleta`).toContain("<PantallaCompleta");
    }
  });
});

describe("la salida lleva a donde dice", () => {
  it("ninguna manda a la raíz, que desde el #550 es la landing", () => {
    /*
     * `p/not-found.tsx` decía «Ver las rutas» y llevaba a `/`. Cuando la raíz
     * era la app, era correcto; desde el #550 la raíz es la **landing**, así
     * que la salida dejó de llevar a donde dice — y quien cae ahí ya se topó
     * con una liga que no funcionó.
     *
     * Es la clase de defecto que un cambio de direcciones deja detrás sin que
     * nada se caiga: la liga sigue siendo válida, sólo que ya no va al mismo
     * lugar.
     */
    for (const [archivo, t] of noEncontrados(APP)) {
      const destinos = [...t.matchAll(/a:\s*"([^"]+)"/g)].map((m) => m[1]);
      expect(destinos.length, `${archivo} no declara ninguna salida`).toBeGreaterThan(0);
      for (const d of destinos) {
        expect(d, `${archivo} manda a la raíz, que es la landing`).not.toBe("/");
      }
    }
  });
});

describe("la piel vieja ya no está", () => {
  it("globals.css no declara --ruta: ese valor por omisión es la trampa del #370", () => {
    /*
     * `--ruta` no tiene par de noche **a propósito**: lo inyecta el componente
     * que sabe de qué ruta habla. Un valor por omisión en `:root` hace que
     * usarlo fuera de un subárbol inyectado se vea morado y **creíble** en vez
     * de verse roto.
     */
    const g = readFileSync(path.join(APP, "globals.css"), "utf8");
    expect(g).not.toMatch(/^\s*--ruta(-claro)?\s*:/m);
  });

  it("y lo que el body pinta sale de la paleta, no de un hex del prototipo", () => {
    const g = readFileSync(path.join(APP, "globals.css"), "utf8");
    const sinComentarios = g.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(sinComentarios, "un hex suelto aquí es el blanco que se asomaba al rebotar el scroll").not.toMatch(
      /:\s*#[0-9a-f]{3,8}/i,
    );
  });
});
