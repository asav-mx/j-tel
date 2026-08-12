/**
 * Trae los `.woff2` de las tres fuentes del skill al repo.
 *
 * Existe para que los archivos de `src/app/fuentes/` no sean binarios caídos del
 * cielo: **se regeneran con un comando y se puede comprobar que son los mismos.**
 *
 *   pnpm --filter @jtel/web fuentes:traer
 *
 * NO corre en la compilación ni en CI, a propósito: si corriera, la compilación
 * volvería a depender de la red — que es exactamente el defecto que este cambio
 * vino a quitar. Se corre a mano cuando haya que actualizar una fuente, y el
 * resultado se commitea.
 *
 * **Subset `latin`**, el mismo que pedía `subsets: ["latin"]` en `next/font/google`:
 * cubre el español completo (acentos, ñ, ¿, ¡). Ningún glifo cambia respecto de
 * lo que se servía antes.
 *
 * **Archivo e IBM Plex Sans son VARIABLES.** Google devuelve el mismo archivo
 * para cualquier peso que se le pida —comprobado por hash: el de `wght@600;700`
 * y el de `wght@600;700;800` son idénticos—, así que se guarda UNO por familia y
 * el rango de peso se declara en el layout. IBM Plex Mono sí trae un archivo por
 * peso.
 *
 * Licencias: Archivo (SIL OFL 1.1) e IBM Plex (SIL OFL 1.1). Las dos permiten
 * redistribuir los archivos dentro del proyecto.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Sin UA de navegador, Google devuelve `ttf` en vez de `woff2`. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DESTINO = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "fuentes");

/**
 * `variable: true` → un solo archivo para todos los pesos. El rango se declara
 * en el layout, no aquí.
 */
const FAMILIAS = [
  { familia: "Archivo", pesos: [600, 700, 800], variable: true, nombre: "archivo" },
  { familia: "IBM Plex Sans", pesos: [400, 500], variable: true, nombre: "plex-sans" },
  { familia: "IBM Plex Mono", pesos: [400, 500], variable: false, nombre: "plex-mono" },
];

async function traer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
}

/** El bloque `@font-face` del subset latin para un peso dado. */
function bloqueLatin(css, peso) {
  const bloques = css
    .split("/*")
    .slice(1)
    .map((b) => `/*${b}`);
  return bloques.find(
    (b) => b.startsWith("/* latin */") && b.includes(`font-weight: ${peso};`),
  );
}

async function main() {
  await mkdir(DESTINO, { recursive: true });

  for (const { familia, pesos, variable, nombre } of FAMILIAS) {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familia).replace(/%20/g, "+")}:wght@${pesos.join(";")}&display=swap`;
    const css = await (await traer(url)).text();

    // De una variable basta el primer peso: el archivo es el mismo para todos.
    const aBajar = variable ? [pesos[0]] : pesos;

    for (const peso of aBajar) {
      const bloque = bloqueLatin(css, peso);
      if (!bloque) throw new Error(`Sin bloque latin para ${familia} ${peso}`);
      const url2 = bloque.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
      if (!url2) throw new Error(`Sin woff2 para ${familia} ${peso}`);

      const bin = Buffer.from(await (await traer(url2)).arrayBuffer());
      const archivo = variable ? `${nombre}-variable.woff2` : `${nombre}-${peso}.woff2`;
      await writeFile(join(DESTINO, archivo), bin);
      const sha = createHash("sha256").update(bin).digest("hex").slice(0, 16);
      console.log(`${archivo.padEnd(28)} ${String(bin.length).padStart(7)} bytes  sha256:${sha}`);
    }
  }

  console.log(
    `\nListo. Si algún hash cambió, la fuente se actualizó aguas arriba:\n` +
      `revísalo en el navegador en los dos temas antes de commitear.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
