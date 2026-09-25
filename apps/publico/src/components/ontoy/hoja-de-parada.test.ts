import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * **LA HOJA DE PARADA.**
 *
 * ## Qué NO prueba
 *
 * **No monta la pantalla.** Lo que se ve —que la placa no cuelgue, que un
 * nombre de parada de 40 letras quepa— se mira. Aquí se cercan las decisiones
 * que se deshacen escribiendo la siguiente pantalla.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const hoja = readFileSync(path.join(AQUI, "hoja-de-parada.tsx"), "utf8");
const ontoy = readFileSync(path.join(AQUI, "ontoy.tsx"), "utf8");
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("la firma de la promesa sigue a la FUENTE, no al estado", () => {
  /*
   * La regla del #377. «Esta ruta no publica cada cuánto pasa» es una frase
   * **nuestra** sobre un hueco: firmarla «según la concesión» le atribuiría a
   * alguien algo que justamente no dijo — la ley de no exponer al operador,
   * invertida.
   */
  it("la hoja no decide la firma por su cuenta: se la dicen", () => {
    expect(sinComentarios(hoja)).toContain("promesaDeclarada &&");
    expect(
      sinComentarios(hoja),
      "mirar la frase para decidir la firma es adivinar la fuente",
    ).not.toMatch(/promesa\.(includes|startsWith|match)/);
  });

  it("y quien se la dice mira el estado de la promesa, que es de dónde viene", () => {
    expect(sinComentarios(ontoy)).toContain('vivo?.promesa?.estado === "declarada"');
  });
});

describe("la cifra grande", () => {
  it("sale del número, no de recortar la frase", () => {
    /*
     * Partir «a 3 paradas» con una expresión se equivocaría en silencio el día
     * que la frase diga «a 1 parada» en singular, o cambie de orden. Quien
     * construye el rótulo tiene el número; lo manda.
     */
    expect(sinComentarios(ontoy)).toContain("cifra: { valor: String(p.paradas)");
    expect(sinComentarios(hoja), "la hoja no parte cadenas").not.toMatch(/rotulo\.(split|match|slice)/);
  });

  it("el rango NO se parte: «4–7 min» es un valor con dos extremos", () => {
    /*
     * Agrandar sólo el «4» lo volvería una promesa de cuatro minutos con el
     * resto en letra chica. La cuenta de paradas sí se parte, porque ahí el
     * número es uno solo.
     */
    const bloque = sinComentarios(ontoy);
    const i = bloque.indexOf("rotulo: rangoEnPalabras(l.rango)");
    expect(i).toBeGreaterThan(0);
    expect(bloque.slice(i, i + 260)).not.toContain("cifra:");
  });

  it("la posición vieja no lleva cifra grande", () => {
    /*
     * 8.9, decisión de ASAV del 22-sep: es lo último que se vio, no dónde está.
     * El número grande es lo que el ojo lee primero, y dárselo a un dato de
     * hace seis minutos lo presenta como si fuera de ahorita.
     */
    const bloque = sinComentarios(ontoy);
    const i = bloque.indexOf("rotulo: `iba ${paradasEnPalabras");
    expect(i).toBeGreaterThan(0);
    expect(bloque.slice(i, i + 300)).not.toContain("cifra:");
  });

  it("un rótulo que no es cifra se dibuja entero", () => {
    /*
     * «Fuera de horario» no tiene un número que agrandar, y agrandarle la
     * primera palabra lo volvería un titular falso. Y necesita el ancho
     * completo: metido en la columna estrecha se desbordaba fuera de la hoja,
     * lo cual enseñó la captura.
     */
    expect(sinComentarios(hoja)).toContain("l.cifra ? (");
    expect(readFileSync(path.join(AQUI, "../../app/ontoy.css"), "utf8")).toContain(
      ".ontoy-llegada.con-cifra",
    );
  });
});

describe("Tino dice lo mismo que la fila de abajo", () => {
  it("su mirada sale de las llegadas, no de una variable aparte", () => {
    /*
     * Es la misma pregunta contestada dos veces en la misma pantalla. Si la
     * cara saliera de otro lado podría decir «de allá viene» encima de una fila
     * que dice «sin unidad a la vista».
     */
    expect(sinComentarios(hoja)).toContain('llegadas.some((l) => l.enVivo) ? "de-lado"');
  });
});
