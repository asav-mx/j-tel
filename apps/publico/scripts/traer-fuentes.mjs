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
 * **Casi todas son VARIABLES**: Google devuelve un solo archivo para todos los
 * pesos, así que se guarda UNO por familia y el rango se declara donde se usa.
 * IBM Plex Mono es la excepción: trae un archivo por peso.
 *
 * Licencias: las cuatro familias, SIL OFL 1.1 — permiten redistribuir los
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

/**
 * Las dos letras de Ontoy, y son dos porque hoy hay dos caras.
 *
 * - **La app** (`app/layout.tsx`): Archivo + IBM Plex — decisión de ASAV, 21-sep.
 * - **La landing** (`app/landing/`): Bricolage Grotesque + Instrument Sans, que
 *   es lo que piden los tokens del sistema de diseño
 *   (`.claude/skills/ontoy-design/tokens/typography.css`) y con lo que está
 *   dibujada la landing aprobada.
 *
 * Que sean distintas es a propósito y es temporal: la app cambia a los tokens
 * en su propio PR. Mientras tanto, **ningún archivo se descarga dos veces**: el
 * navegador sólo baja los de la página que abrió, y nadie abre las dos a la vez.
 *
 * `consulta` existe porque Bricolage Grotesque tiene **dos ejes** —`opsz` y
 * `wght`—, y Google quiere los dos nombrados en orden alfabético o devuelve un
 * 400. Las demás se arman con sus pesos y ya.
 */
const FAMILIAS = [
  { familia: "Archivo", pesos: [600, 700], variable: true, nombre: "archivo" },
  { familia: "IBM Plex Sans", pesos: [400, 500, 600], variable: true, nombre: "plex-sans" },
  { familia: "IBM Plex Mono", pesos: [400, 500], variable: false, nombre: "plex-mono" },
  {
    familia: "Bricolage Grotesque",
    pesos: [600, 800],
    variable: true,
    nombre: "bricolage",
    consulta: "Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800",
  },
  { familia: "Instrument Sans", pesos: [400, 500, 600, 700], variable: true, nombre: "instrument-sans" },
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

  for (const { familia, pesos, variable, nombre, consulta } of FAMILIAS) {
    const familiaEnLaUrl = consulta ?? `${familia.replace(/ /g, "+")}:wght@${pesos.join(";")}`;
    const url = `https://fonts.googleapis.com/css2?family=${familiaEnLaUrl}&display=swap`;
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
