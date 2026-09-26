import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **«IR A»** (app-v1, 25-sep). No monta la pantalla; cerca las dos decisiones
 * de Asav que una edición distraída deshace.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const vista = readFileSync(path.join(AQUI, "vista-ira.tsx"), "utf8");
const raiz = readFileSync(path.join(AQUI, "ontoy.tsx"), "utf8");
/* Lo que el pasajero lee: sin los comentarios, que sí hablan del planeador y por qué no está. */
const visible = vista.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("«Ir a» no anuncia el planeador", () => {
  it("la palabra no sale en la pantalla", () => {
    expect(visible).not.toMatch(/planeador/i);
  });
});

describe("una búsqueda sin resultados no es un callejón (8.10)", () => {
  it("ofrece «Ver todas las rutas», y el botón lleva a la lista de Inicio", () => {
    expect(visible).toContain("onClick={alVerTodasLasRutas}");
    expect(visible).toContain("Ver todas las rutas");
    expect(raiz).toContain("alVerTodasLasRutas={verTodasLasRutas}");
    expect(raiz).toContain('document.getElementById("ontoy-rutas")');
    /* Y la lista llega ABIERTA: Inicio enseña tres, el botón prometió todas. */
    expect(raiz).toMatch(/verTodasLasRutas = useCallback\(\(\) => \{[\s\S]*?setRutasAbiertas\(true\)/);
    expect(raiz).toContain("rutasAbiertas={rutasAbiertas}");
  });

  it("no promete un número de ruta que no existe", () => {
    expect(visible).not.toMatch(/número de la ruta/);
  });
});

describe("antes de escribir (3-ir-a/02)", () => {
  it("Ontoy dice qué escribir, y debajo van tus paradas", () => {
    expect(visible).toContain("<AntesDeEscribir guardadas={guardadas}");
    expect(visible).toContain("Escribe el nombre de tu parada o de la ruta.");
    expect(visible).toContain("Tus paradas");
    expect(raiz).toContain("guardadas={guardadas.guardadas}");
  });

  it("sólo cuando no se ha escrito nada: al escribir, manda la búsqueda", () => {
    expect(visible).toMatch(/\{escribio \? \([\s\S]*?\) : \(\s*<AntesDeEscribir/);
  });
});

describe("los resultados de «Ir a», como la lámina 3/04", () => {
  const fuente = readFileSync(new URL("./vista-ira.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../../app/ontoy.css", import.meta.url), "utf8");

  it("primero las rutas y luego las paradas, cada grupo con su título", () => {
    const rutas = fuente.indexOf("{rutasEncontradas.length > 0 && (");
    const paradas = fuente.indexOf("{paradasEncontradas.length > 0 && (");
    expect(rutas).toBeGreaterThan(0);
    expect(paradas).toBeGreaterThan(rutas);
  });

  it("sin rótulos «PARADA»/«RUTA» y sin placa: franja y nombre, como Inicio", () => {
    expect(fuente).not.toContain('className="ontoy-ira-que');
    const resultados = fuente.slice(fuente.indexOf("{rutasEncontradas.length > 0 && ("), fuente.indexOf("Recortar callando"));
    expect(resultados).not.toContain("ontoy-placa");
    expect(resultados.match(/ontoy-franja-vertical/g) ?? []).toHaveLength(2);
  });

  it("una ruta dice su frecuencia con firma; una parada, de qué ruta es", () => {
    expect(fuente).toContain("promesaFirmada(ruta.promesa, null)");
    expect(fuente).toContain("Ruta {s.circuitoNombre}");
  });

  it("el buscador mide 56 y lleva el borde de 2 px en la tinta del texto", () => {
    const i = css.indexOf(".ontoy-ira-campo {");
    const regla = css.slice(i, css.indexOf("}", i));
    expect(regla).toContain("min-height: 56px");
    expect(regla).toContain("border: 2px solid var(--texto)");
  });
});
