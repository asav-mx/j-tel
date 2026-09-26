import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * **Ninguna liga lleva a la app por `/?ruta=`.**
 *
 * La raíz de ontoy.app es la landing, y la landing no lee `?ruta`. Una liga a
 * `/?ruta=‹slug›` deja al pasajero en la página de presentación en vez de en su
 * ruta — y así estuvieron dos: la redirección de las ligas viejas `/c/‹slug›`
 * (compartidas por WhatsApp y pegadas en postes) y el «Ver la ruta» de una
 * parada retirada. La app vive en `/rutas`.
 *
 * **Lo que NO prueba**: que `/rutas?ruta=` abra la ruta correcta — eso lo
 * comprueba el navegador. Prueba que nadie vuelva a escribir la dirección que ya
 * no lleva a ningún lado, que es un error de texto y se atrapa leyendo texto.
 */
const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return n === "node_modules" ? [] : archivos(p);
    return /\.(tsx?|mjs)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

function sinComentarios(codigo: string): string {
  return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("las ligas a la app", () => {
  it("ninguna apunta a /?ruta= — la raíz es la landing", () => {
    const culpables = archivos(RAIZ)
      /* Sin comentarios: el que cuenta la historia puede citar la dirección
         vieja; lo que no puede es LLEVAR a ella. */
      .filter((f) => /["'`]\/\?ruta=/.test(sinComentarios(readFileSync(f, "utf8"))))
      .map((f) => path.relative(RAIZ, f));
    expect(culpables).toEqual([]);
  });
});
