/**
 * Trae al repo el mapa de la ciudad — el `.pmtiles` que la app sirve de fondo.
 *
 *   pnpm --filter @jtel/publico mapa:traer            # el build de hoy
 *   pnpm --filter @jtel/publico mapa:traer 20260924   # un build concreto
 *
 * Recorta Ciudad Juárez y El Paso del **build global de Protomaps** —138 GB en
 * un solo `.pmtiles` público— pidiendo por **rangos** nada más las teselas de
 * ese pedazo. Con eso bajan 18 MB en unos segundos, no 138 GB.
 *
 * ## Por qué el archivo se commitea, igual que las fuentes
 *
 * Misma razón que `traer-fuentes.mjs`, escrita para el mismo defecto: **este
 * guion NO corre en la compilación ni en CI.** Si corriera, compilar volvería a
 * depender de que un servidor ajeno contestara — que es exactamente lo que este
 * archivo en el repo vino a quitar (#294 en la web, #493 y #498 en Ontoy, las
 * tres veces con las fuentes). Se corre a mano cuando haya que refrescar el
 * mapa, y el resultado se commitea.
 *
 * Y el archivo no es un binario caído del cielo: **se regenera con un comando y
 * se puede comprobar que es el mismo**. El guion imprime su tamaño y su sha256.
 *
 * ## La herramienta
 *
 * El recorte lo hace `pmtiles`, el programa de Protomaps (Go, BSD-3). No es una
 * dependencia de npm y no se instala sola, a propósito: sólo la necesita quien
 * refresca el mapa, y un binario de 55 MB no tiene nada que hacer en el
 * `node_modules` de todos. Se baja de
 * https://github.com/protomaps/go-pmtiles/releases y se pone en el PATH, o se
 * apunta con `PMTILES=/ruta/al/pmtiles`.
 *
 * ## Lo que el recorte decide, y por qué
 *
 * **La caja.** `-107.00,31.20 → -105.95,32.20`: Juárez completo, **suficiente El
 * Paso para que la frontera no se vea cortada** —es lo primero que un juarense
 * ubica en un mapa de su ciudad— y **margen de sobra alrededor**. Incluye Anapra
 * y Sunland Park al poniente, el valle de Juárez al oriente y el noreste de El
 * Paso por arriba.
 *
 * El margen no es generosidad: la primera caja iba pegada a la ciudad y, al
 * alejar en un teléfono alto, el mapa enseñaba un **vacío de borde recto** donde
 * se acababa el recorte. Cuesta 4.8 MB más en el repo y cero para el pasajero,
 * que sólo baja los pedazos que mira. Ver `mapa-base.ts` (`zoomMinimo`).
 *
 * **Hasta z15**, que es el máximo que trae el build de Protomaps. No es poco: el
 * dibujo es vectorial, así que de z15 a z19 el mapa sigue acercándose con las
 * mismas calles, nítidas — lo que no hay es *más detalle*, y a esa escala ya
 * está cada calle con su nombre.
 *
 * **Desde z0**, y cuesta casi nada: las teselas de zoom bajo son pocas y cada
 * una cubre una región enorme, así que alejar el mapa enseña el contexto en vez
 * de quedarse en blanco.
 *
 * ## Cuando lo vuelvas a correr
 *
 * 1. El nombre del archivo **lleva la fecha del build** (`juarez-AAAAMMDD.pmtiles`).
 *    No es decoración: la dirección cambia, así que ningún teléfono ni ningún
 *    CDN sirve el mapa viejo desde su caché.
 * 2. Por eso hay que mover `FECHA_DEL_MAPA` en `src/lib/ontoy/mapa-base.ts` y
 *    **borrar el archivo anterior**. Si no, el repo carga dos mapas y la app
 *    sirve el que diga la constante. Lo cuida `mapa-base.test.ts`, que se cae si
 *    la constante y el archivo no coinciden, y si sobra un `.pmtiles`.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** La caja de la ciudad: `min_lon,min_lat,max_lon,max_lat`. Ver arriba. */
const CAJA = "-107.00,31.20,-105.95,32.20";
/** El máximo que trae el build de Protomaps; más no existe. */
const ZOOM_MAXIMO = 15;

const AQUI = dirname(fileURLToPath(import.meta.url));
const DESTINO = join(AQUI, "..", "public", "mapa");
const PMTILES = process.env.PMTILES ?? "pmtiles";

/** `AAAAMMDD`. Sin argumento, el build de hoy: se publica uno diario. */
const fecha = process.argv[2] ?? new Date().toISOString().slice(0, 10).replaceAll("-", "");
if (!/^\d{8}$/.test(fecha)) {
  console.error(`La fecha del build se escribe AAAAMMDD; llegó «${fecha}».`);
  process.exit(1);
}

const origen = `https://build.protomaps.com/${fecha}.pmtiles`;
const salida = join(DESTINO, `juarez-${fecha}.pmtiles`);

try {
  execFileSync(PMTILES, ["--help"], { stdio: "ignore" });
} catch {
  console.error(
    [
      `No encontré el programa «${PMTILES}».`,
      "",
      "Se baja de https://github.com/protomaps/go-pmtiles/releases (un solo",
      "binario, sin instalador) y se pone en el PATH, o se apunta así:",
      "",
      "  PMTILES=/ruta/al/pmtiles pnpm --filter @jtel/publico mapa:traer",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`Recortando ${origen}`);
console.log(`  caja ${CAJA} · z0–${ZOOM_MAXIMO}`);
execFileSync(PMTILES, ["extract", origen, salida, `--bbox=${CAJA}`, `--maxzoom=${ZOOM_MAXIMO}`], {
  stdio: "inherit",
});

const bytes = readFileSync(salida);
const sobrantes = readdirSync(DESTINO).filter((n) => n.endsWith(".pmtiles") && !salida.endsWith(n));

console.log("");
console.log(`Listo: public/mapa/juarez-${fecha}.pmtiles`);
console.log(`  ${(bytes.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`  sha256 ${createHash("sha256").update(bytes).digest("hex")}`);
console.log("");
console.log(`Falta a mano: FECHA_DEL_MAPA = "${fecha}" en src/lib/ontoy/mapa-base.ts`);
if (sobrantes.length > 0) {
  console.log(`Y borrar el mapa viejo: ${sobrantes.map((n) => `public/mapa/${n}`).join(", ")}`);
}
