/**
 * ¿Alguna app vuelve a bajar su letra de internet al compilar?
 *
 *   pnpm fuentes:check
 *
 * Sale con código 1 si cualquier archivo de `apps/` o `packages/` importa
 * `next/font/google`.
 *
 * ## Por qué
 *
 * `next/font/google` descarga las fuentes **durante `next build`**. Si Google no
 * contesta, no falla la tipografía: **falla la compilación**, y el rojo no se
 * distingue de un defecto propio hasta leer el log. Pasó en la web el 12-ago-2026
 * (#294) y en Ontoy el 22-sep (#493, #498), las dos veces en PRs que no tocaban
 * la app que se cayó. Las dos apps ya sirven sus fuentes desde el repo
 * (`src/app/fuentes/` de cada una, con su LEEME).
 *
 * Esta valla corre en CI **antes de compilar** para que la regresión se lea como
 * lo que es —«alguien volvió a importar next/font/google»— y no como un
 * `TypeError` intermitente de red.
 *
 * Mira las importaciones, no el texto: los comentarios que explican por qué ya
 * no se usa `next/font/google` lo nombran, y deben poder seguir nombrándolo.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const EXTENSIONES = /\.(tsx?|jsx?|mjs|cjs)$/;

/**
 * `import … from "next/font/google"`, `import "next/font/google"`,
 * `import("next/font/google")`, `require("next/font/google")` y
 * `export … from "next/font/google"`. También sus subrutas.
 */
const IMPORTACION =
  /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)["']next\/font\/google(?:\/[^"']*)?["']/;

/** Quita comentarios de bloque y de línea, conservando los saltos de línea. */
function sinComentarios(texto) {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Los números de línea (desde 1) donde el texto importa `next/font/google`. */
export function lineasQueImportanDeGoogle(texto) {
  return sinComentarios(texto)
    .split("\n")
    .flatMap((linea, i) => (IMPORTACION.test(linea) ? [i + 1] : []));
}

/** Archivos de código de `apps/` y `packages/`, versionados o nuevos sin ignorar. */
function archivosDeCodigo() {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "apps", "packages"],
    { encoding: "utf8" },
  )
    .split("\n")
    .filter((f) => EXTENSIONES.test(f));
}

function main() {
  const hallazgos = [];
  for (const archivo of archivosDeCodigo()) {
    let texto;
    try {
      texto = readFileSync(archivo, "utf8");
    } catch {
      continue; // borrado en el árbol de trabajo y aún versionado
    }
    for (const linea of lineasQueImportanDeGoogle(texto)) hallazgos.push(`${archivo}:${linea}`);
  }

  if (hallazgos.length === 0) {
    console.log("Ninguna app baja su letra de internet al compilar.");
    return;
  }

  console.error(
    `✗ ${hallazgos.length} importación(es) de next/font/google:\n\n` +
      hallazgos.map((h) => `  ${h}`).join("\n") +
      `\n\nnext/font/google descarga las fuentes durante next build: si Google no\n` +
      `contesta, se cae la compilación. Usa next/font/local con los .woff2 de\n` +
      `src/app/fuentes/ (ver el LEEME de esa carpeta en apps/web o apps/publico).`,
  );
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
