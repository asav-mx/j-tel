/**
 * Trae al repo los `.woff2` de la letra de Ontoy.
 *
 *   pnpm --filter @jtel/publico fuentes:traer
 *
 * Existe para que los archivos de `src/app/fuentes/` no sean binarios caídos del
 * cielo: **se regeneran con un comando y se puede comprobar que son los mismos.**
 *
 * NO corre en la compilación ni en CI, a propósito: si corriera, la compilación
 * volvería a depender de la red — que es exactamente el defecto que estos
 * archivos vinieron a quitar. Se corre a mano cuando haya que actualizar una
 * fuente, y el resultado se commitea.
 *
 * ## Por qué no se copian los de `apps/web`
 *
 * Son las mismas familias, el mismo subset `latin`, los mismos 229–232
 * caracteres y el mismo rango de peso. Pero el guion de la web pide a Google con
 * un navegador de **Windows**, y a Windows Google le sirve los archivos **con
 * hinting** (instrucciones de rasterizado para sus pantallas): ~15 KB más entre
 * los cuatro. Este pide como pedía `next/font/google` —un Chrome de **Mac**—, y
 * lo que baja es **byte por byte** lo que Ontoy servía antes de este cambio.
 * En un teléfono con datos contados, el pasajero no descarga ni un byte más.
 *
 * **Subset `latin`**, el mismo que pedía `subsets: ["latin"]`: cubre el español
 * completo (acentos, ñ, ¿, ¡).
 *
 * **Archivo e IBM Plex Sans son VARIABLES**: Google devuelve un solo archivo
 * para todos los pesos, así que se guarda UNO por familia y el rango se declara
 * en el layout. IBM Plex Mono trae un archivo por peso.
 *
 * Licencias: Archivo e IBM Plex, SIL OFL 1.1 — permiten redistribuir los
 * archivos dentro del proyecto.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** El que usa `next/font/google` (next 15): de él depende que salga woff2 sin hinting. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";

const DESTINO = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "fuentes");

/** Los pesos son los que declara `app/layout.tsx`. */
const FAMILIAS = [
  { familia: "Archivo", pesos: [600, 700], variable: true, nombre: "archivo" },
  { familia: "IBM Plex Sans", pesos: [400, 500, 600], variable: true, nombre: "plex-sans" },
  { familia: "IBM Plex Mono", pesos: [400, 500], variable: false, nombre: "plex-mono" },
];

async function traer(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res;
}

/** El bloque `@font-face` del subset latin para un peso dado. */
function bloqueLatin(css, peso) {
  return css
    .split("/*")
    .slice(1)
    .map((b) => `/*${b}`)
    .find((b) => b.startsWith("/* latin */") && b.includes(`font-weight: ${peso};`));
}

async function main() {
  await mkdir(DESTINO, { recursive: true });

  for (const { familia, pesos, variable, nombre } of FAMILIAS) {
    const url = `https://fonts.googleapis.com/css2?family=${familia.replace(/ /g, "+")}:wght@${pesos.join(";")}&display=swap`;
    const css = await (await traer(url)).text();

    // De una variable basta el primer peso: el archivo es el mismo para todos.
    for (const peso of variable ? [pesos[0]] : pesos) {
      const bloque = bloqueLatin(css, peso);
      if (!bloque) throw new Error(`Sin bloque latin para ${familia} ${peso}`);
      const url2 = bloque.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
      if (!url2) throw new Error(`Sin woff2 para ${familia} ${peso}`);

      const bin = Buffer.from(await (await traer(url2)).arrayBuffer());
      const archivo = variable ? `${nombre}-variable.woff2` : `${nombre}-${peso}.woff2`;
      await writeFile(join(DESTINO, archivo), bin);
      const sha = createHash("sha256").update(bin).digest("hex").slice(0, 16);
      console.log(`${archivo.padEnd(26)} ${String(bin.length).padStart(7)} bytes  sha256:${sha}`);
    }
  }

  console.log(
    `\nListo. Si algún hash cambió contra src/app/fuentes/LEEME.md, la fuente se\n` +
      `actualizó aguas arriba: revísala en el navegador en las dos pieles antes de commitear.`,
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
