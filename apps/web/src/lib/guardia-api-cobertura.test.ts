import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Toda ruta de API pasa por una guardia, o dice por qué no.
 *
 * La sesión que exige `exigir()` desde el 14 de septiembre de 2026 sólo
 * protege a quien llama `exigir()`. Una ruta nueva que lea la base sin guardia
 * no rompería nada ni tumbaría ninguna prueba — y respondería a cualquiera.
 * Esta prueba lee el árbol de `app/api` y hace nacer en rojo a esa ruta.
 */

const API = path.join(fileURLToPath(new URL("../app/api", import.meta.url)));

/** Excepciones, con nombre y motivo. */
const EXENTAS: Record<string, string> = {
  "casa/cronometro/route.ts":
    "No lee la base ni datos de ninguna cuenta: sólo escribe en los registros los tiempos que mide el " +
    "navegador (números y rutas del cascarón). Pide sesión por su cuenta con sesionUtilizable; no hay " +
    "audiencia de «cualquier sesión» en exigir(). Temporal, se quita al cerrar la lentitud (16 sep 2026).",
  "salud/route.ts":
    "Pública a propósito: la sondea el vigilante externo de GitHub sin credencial. " +
    "Devuelve el veredicto de salud agregado, no datos de ninguna cuenta.",
};

/** Las llamadas que cuentan como guardia. Un comentario que las nombre no cuenta. */
const GUARDIA = /\b(exigir|exigirCron)\(/;

function rutas(dir: string, base = ""): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completa = path.join(dir, entrada);
    const relativa = base ? `${base}/${entrada}` : entrada;
    if (statSync(completa).isDirectory()) salida.push(...rutas(completa, relativa));
    else if (entrada === "route.ts") salida.push(relativa);
  }
  return salida;
}

/** El código sin comentarios, para que nombrar la guardia en prosa no la cuente. */
function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("cobertura de la guardia en app/api", () => {
  const todas = rutas(API);

  it("encuentra las rutas (si esto da cero, la prueba no está mirando nada)", () => {
    expect(todas.length).toBeGreaterThan(30);
  });

  it("cada route.ts llama a una guardia, o está en la lista de exentas con su motivo", () => {
    const sinGuardia = todas.filter(
      (r) => !EXENTAS[r] && !GUARDIA.test(sinComentarios(readFileSync(path.join(API, r), "utf8"))),
    );
    expect(sinGuardia).toEqual([]);
  });

  it("ninguna exenta tiene guardia de verdad — si la tiene, sobra en la lista", () => {
    for (const r of Object.keys(EXENTAS)) {
      expect(todas).toContain(r);
      expect(GUARDIA.test(sinComentarios(readFileSync(path.join(API, r), "utf8")))).toBe(false);
    }
  });
});
