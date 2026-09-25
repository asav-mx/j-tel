import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LIENZO, TOKENS_DEL_MAPA, pielDelMapa } from "./piel-del-mapa";

/*
 * LA ROPA DEL MAPA contra la paleta.
 *
 * ## Por qué hace falta una valla aquí, y no basta con la de la piel
 *
 * `piel-de-ontoy.test.ts` cerca los colores de **las hojas de estilo**. Los del
 * mapa no viven en CSS: viven en un objeto de JavaScript, porque el mapa se
 * dibuja en un `<canvas>` y un canvas no lee `var(--banqueta)`. Son cuarenta y
 * tantos hex escritos a mano, en un archivo que nadie abre seguido, y **ninguno
 * se ve hasta que el mapa se dibuja**. Es exactamente el lugar donde «nunca
 * inventes un hex» se rompe sin que nada se queje.
 *
 * ## Qué NO prueba
 *
 * **No prueba que el mapa se vea bien.** Que las calles se distingan del suelo,
 * que las manzanas no griten y que los nombres se lean con sol es cosa de
 * mirarlo — y por eso el PR va con capturas de las dos pieles.
 *
 * **No prueba el contraste de la traza de una ruta.** Ése sale del dato
 * (`color_hex`) y lo resuelve `contraste-de-ruta.ts` midiendo contra el lienzo.
 * Lo que sí prueba es que el lienzo que esa función mide **sea el suelo que el
 * mapa pinta de verdad**, que es lo que antes no se podía saber.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_DE_LA_APP = path.join(AQUI, "../../app/tokens-ontoy.css");
const FUENTE = path.join(AQUI, "piel-del-mapa.ts");

/** `--nombre: #hex;` de la paleta de la app. */
function paleta(): Map<string, string> {
  const css = readFileSync(TOKENS_DE_LA_APP, "utf8");
  const m = new Map<string, string>();
  for (const [, nombre, valor] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    m.set(nombre.slice(2), valor.toLowerCase());
  }
  return m;
}

/** Luminancia relativa (WCAG), para medir el texto del mapa. */
function contraste(a: string, b: string): number {
  const canal = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luz = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return (
      0.2126 * canal(((n >> 16) & 255) / 255) +
      0.7152 * canal(((n >> 8) & 255) / 255) +
      0.0722 * canal((n & 255) / 255)
    );
  };
  const [x, y] = [luz(a), luz(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("cada color del mapa sale de un token", () => {
  const tokens = paleta();

  it("la paleta de la app se pudo leer (guarda contra un falso verde)", () => {
    expect(tokens.get("banqueta")).toBe("#ede9e1");
    expect(tokens.size).toBeGreaterThan(20);
  });

  it("los hex del mapa son los de la paleta, token por token", () => {
    for (const [nombre, hex] of Object.entries(TOKENS_DEL_MAPA)) {
      expect(tokens.get(nombre), `--${nombre}`).toBe(hex);
    }
  });

  it("no hay un solo hex en el archivo que no esté en la tabla de tokens", () => {
    /*
     * La tabla de arriba prueba que lo declarado coincide; esto prueba que **no
     * haya nada declarado por fuera de la tabla**. Sin este caso, un `#8ab4f8`
     * pegado directamente en un color del estilo pasaría sin que nadie lo viera.
     */
    const declarados = new Set(Object.values(TOKENS_DEL_MAPA));
    /*
     * **Mira el código, no los comentarios.** El comentario del lienzo nombra a
     * propósito los dos hex viejos —los que se medían a ojo del mapa teñido— para
     * explicar de dónde salían, y tiene que poder seguir nombrándolos. Es la
     * misma razón por la que la valla de las fuentes mira las importaciones y no
     * el texto.
     */
    const codigo = readFileSync(FUENTE, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    const enElArchivo = [...codigo.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].toLowerCase());
    expect(enElArchivo.length).toBeGreaterThan(0);
    for (const hex of enElArchivo) expect(declarados, hex).toContain(hex);
  });

  it("el mapa NO usa el naranja de Ontoy, ni el cobre ni el verde de J-Tel", () => {
    /*
     * **El naranja es de Ontoy y de nadie más.** Un mapa con carreteras naranjas
     * —que es como OSM las pinta— le pone la marca del pasajero a la
     * infraestructura de la ciudad. Y los dos de J-Tel (`--vivo`, `--senal`)
     * tienen significado: el verde dice «este dato está vivo ahora» y el cobre
     * «esto se está moviendo». Una calle pintada con ellos afirma algo.
     */
    const prohibidos = ["ontoy", "ontoy-sombra", "vivo", "senal"];
    const archivo = readFileSync(FUENTE, "utf8").toLowerCase();
    for (const nombre of prohibidos) {
      const hex = tokens.get(nombre);
      expect(hex, `--${nombre} no está en la paleta`).toBeTruthy();
      expect(archivo, `--${nombre} (${hex})`).not.toContain(hex!);
    }
  });
});

describe("el lienzo es el suelo que el mapa pinta de verdad", () => {
  it("de día es banqueta y de noche azul noche — los mismos que el fondo de la app", () => {
    const tokens = paleta();
    expect(LIENZO.dia).toBe(tokens.get("banqueta"));
    expect(LIENZO.noche).toBe(tokens.get("noche"));
  });

  it("y es el color con el que el mapa rellena, no un valor suelto", () => {
    /* Si estos dos se separaran, el halo de la traza (8.8c) se mediría contra un
       fondo que no existe: el defecto sería invisible y el halo, inútil. */
    expect(pielDelMapa(false).earth).toBe(LIENZO.dia);
    expect(pielDelMapa(false).background).toBe(LIENZO.dia);
    expect(pielDelMapa(true).earth).toBe(LIENZO.noche);
    expect(pielDelMapa(true).background).toBe(LIENZO.noche);
  });
});

describe("las dos pieles", () => {
  it("ninguna clave se queda con el color de la otra", () => {
    /*
     * El modo de falla que cierra es el del #370, en el mapa: una clave que se
     * copió de la piel de día a la de noche y se quedó clara. No se vería como
     * un error —el mapa se dibuja— sino como una calle blanca de noche.
     *
     * Se exceptúa el agua: es **el mismo token en las dos pieles**, a propósito.
     */
    const dia = pielDelMapa(false) as unknown as Record<string, string>;
    const noche = pielDelMapa(true) as unknown as Record<string, string>;
    const mismasAProposito = new Set(["water"]);
    for (const clave of Object.keys(dia)) {
      if (mismasAProposito.has(clave)) continue;
      expect(noche[clave], clave).not.toBe(dia[clave]);
    }
  });

  it("las dos declaran exactamente las mismas claves", () => {
    expect(Object.keys(pielDelMapa(true)).sort()).toEqual(Object.keys(pielDelMapa(false)).sort());
  });

  it("no hay POIs ajenos ni manchones de cobertura: las dos claves opcionales se quedan vacías", () => {
    /*
     * Así se apagan los POIs del estilo de Protomaps: **no dándole colores**. Es
     * la regla del §9 («sin POIs ajenos») sostenida por una ausencia, y una
     * ausencia se repone sin querer — de ahí esta prueba.
     */
    for (const piel of [pielDelMapa(false), pielDelMapa(true)]) {
      expect(piel.pois).toBeUndefined();
      expect(piel.landcover).toBeUndefined();
    }
  });

  it("el texto del mapa pasa el piso de 4.5:1 sobre su propio suelo", () => {
    /*
     * Los nombres de calle se leen en la calle, con sol, y por eso valen como
     * texto y no como gráfico. De día el apagado va en `--carbon-2` y no en
     * `--gris`: el gris mide 4.16:1 sobre banqueta (enmienda (e), ASAV 24-sep).
     */
    const dia = pielDelMapa(false);
    expect(contraste(dia.roads_label_minor, LIENZO.dia)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(dia.roads_label_major, LIENZO.dia)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(dia.city_label, LIENZO.dia)).toBeGreaterThanOrEqual(4.5);

    const noche = pielDelMapa(true);
    expect(contraste(noche.roads_label_minor, LIENZO.noche)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(noche.roads_label_major, LIENZO.noche)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(noche.city_label, LIENZO.noche)).toBeGreaterThanOrEqual(4.5);
  });

  it("el halo es lo que separa al texto de la calle que tiene debajo, y también se mide", () => {
    /*
     * **El caso que esto cierra, y que la prueba de arriba NO ve.** Un nombre de
     * calle no cae sobre el suelo: cae sobre la calle, y las avenidas son lo más
     * claro del mapa. De noche el texto apagado (`--arena-2`) sobre una avenida
     * (`--gris`) mide **2.82:1** — debajo del piso.
     *
     * Lo que lo salva es el **halo**: el estilo de Protomaps dibuja cada etiqueta
     * de calle con un trazo de 2 px del color del halo
     * (`LineLabelSymbolizer`, con `stroke` y `width: 2`), así que lo que el ojo
     * compara es el texto contra su halo, no contra la calle. Por eso se mide ese
     * par — y por eso está escrito el 2.82: si una versión nueva de la librería
     * dejara de dibujar el halo, el número al que se cae ya está apuntado.
     */
    for (const piel of [pielDelMapa(false), pielDelMapa(true)]) {
      expect(contraste(piel.roads_label_minor, piel.roads_label_minor_halo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(piel.roads_label_major, piel.roads_label_major_halo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(piel.subplace_label, piel.subplace_label_halo)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(piel.city_label, piel.city_label_halo)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("las calles se ven contra el suelo, aunque sea por poco: el mapa es fondo, no protagonista", () => {
    /*
     * 1.09:1 entre el suelo y una calle es **el diseño aprobado** (§9: suelo
     * banqueta, calles hueso), no un descuido: lo que separa la calle del suelo
     * es su orilla. Se mide aquí para que el número esté escrito, y se exige
     * sólo que **no sean el mismo color** — el día que alguien iguale los dos,
     * el mapa se queda liso y ninguna otra prueba lo nota.
     */
    for (const piel of [pielDelMapa(false), pielDelMapa(true)]) {
      expect(piel.minor_a).not.toBe(piel.earth);
      expect(piel.major).not.toBe(piel.earth);
      expect(piel.minor_casing).not.toBe(piel.minor_a);
      /* Las avenidas van más claras que las calles (§9). */
      expect(contraste(piel.major, piel.earth)).toBeGreaterThan(contraste(piel.minor_a, piel.earth));
    }
  });
});
