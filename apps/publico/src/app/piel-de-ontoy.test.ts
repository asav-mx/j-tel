import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/*
 * LA PIEL DE ONTOY contra su sistema de diseño.
 *
 * ## Por qué existe
 *
 * El skill `ontoy-design` tiene una regla que se enuncia en una línea y no se
 * puede sostener leyendo: **«nunca inventes un hex; si falta un color, sale de
 * `tokens/colors.css`»**. Es la clase de regla que nadie rompe a propósito — se
 * rompe pegando un `#` a las dos de la mañana porque falta un tono, y nada se
 * queja. Aquí se queja.
 *
 * Y la segunda, que costó más caro: **un color del sistema puede no alcanzar
 * donde se usa.** `--gris` es un token legítimo y mide 4.16:1 sobre el fondo de
 * la página, debajo del piso de 4.5 del texto. La regla no es «usa tokens»: es
 * «usa tokens Y mide dónde los pones».
 *
 * ## Qué NO prueba, y hay que leerlo antes que el verde
 *
 * **No prueba que la app se vea bien.** Mide pares de color declarados en las
 * hojas; no sabe qué texto cae sobre qué superficie de verdad. Un texto apagado
 * puesto sobre una tarjeta que a su vez está sobre otra tarjeta no lo ve nadie
 * más que un par de ojos. **La revisión visual sigue siendo la verificación**
 * de un PR de piel; esto sólo impide que lo ya medido se deshaga.
 *
 * **No prueba el color de una ruta.** Ése sale del dato (`color_hex`), lo
 * inyecta el componente y su contraste lo resuelve `contraste-de-ruta.ts`. Aquí
 * no hay forma de conocerlo.
 *
 * **No prueba los bordes.** `--arena` sobre `--banqueta` da 1.20:1 y se queda
 * así: es el diseño aprobado (ASAV, 24-sep) y es lo que la app ya tenía. Se
 * mide abajo para que el número esté escrito, sin exigirlo.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(AQUI, "../../../..");

const TOKENS_DEL_SKILL = path.join(REPO, ".claude/skills/ontoy-design/tokens/colors.css");
const TOKENS_DE_LA_APP = path.join(AQUI, "tokens-ontoy.css");
const PIEL = path.join(AQUI, "ontoy.css");

/** `--nombre: valor;` de un texto CSS, con el valor tal cual. */
function declaraciones(css: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, nombre, valor] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)[;}]/gi)) {
    m.set(nombre, valor.trim());
  }
  return m;
}

/** El cuerpo del bloque cuyo selector es exactamente `selector`. */
function bloque(css: string, selector: string): string {
  const i = css.indexOf(`${selector} {`);
  if (i < 0) throw new Error(`Sin bloque «${selector}»`);
  return css.slice(i, css.indexOf("}", i));
}

const skill = declaraciones(readFileSync(TOKENS_DEL_SKILL, "utf8"));
const cssApp = readFileSync(TOKENS_DE_LA_APP, "utf8");
const cssPiel = readFileSync(PIEL, "utf8");

const paletaDia = declaraciones(bloque(cssApp, ":root"));
const paletaNoche = new Map([
  ...paletaDia,
  ...declaraciones(bloque(cssApp, ':root[data-tema="noche"]')),
]);
const papelesDia = declaraciones(bloque(cssPiel, ":root"));
const papelesNoche = new Map([
  ...papelesDia,
  ...declaraciones(bloque(cssPiel, ':root[data-tema="noche"]')),
]);

/** Resuelve `var(--x)` contra una paleta, hasta llegar a un hex. */
function hex(valor: string, paleta: Map<string, string>): string {
  let v = valor;
  for (let i = 0; i < 6; i++) {
    const ref = v.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
    if (!ref) break;
    const siguiente = paleta.get(ref[1]);
    if (!siguiente) throw new Error(`«${ref[1]}» no está en la paleta`);
    v = siguiente.trim();
  }
  return v.toLowerCase();
}

function luz(h: string): number {
  const c = h.replace("#", "");
  const canal = (x: number) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [0, 2, 4].map((i) => canal(parseInt(c.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** El contraste entre dos hex, redondeado a centésimas como se reporta. */
export function contraste(a: string, b: string): number {
  const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

describe("la derivación del contraste", () => {
  it("negro sobre blanco es 21:1 y un color contra sí mismo es 1:1", () => {
    expect(contraste("#000000", "#ffffff")).toBe(21);
    expect(contraste("#2a2e37", "#2a2e37")).toBe(1);
  });
});

describe("la paleta de la app es la del skill", () => {
  /*
   * El sentido que importa: **de la app hacia el skill**. Cada token que la app
   * declara tiene que valer lo mismo allá. Al revés no se exige — la app no
   * trae los colores de ruta de muestra ni `--pasajero`, y el archivo dice por
   * qué de cada uno.
   */
  const propios = new Set(["--vivo", "--senal"]);
  const delSkill = [...paletaDia.keys()].filter((k) => !propios.has(k));

  it.each(delSkill)("%s vale lo mismo que en tokens/colors.css", (nombre) => {
    const alla = skill.get(nombre);
    expect(alla, `«${nombre}» no existe en el skill. Si es de J-Tel, va en la lista de propios de esta prueba Y en ENMIENDAS.md`).toBeDefined();
    expect(hex(paletaDia.get(nombre)!, paletaDia)).toBe(hex(alla!.trim(), skill));
  });

  it("los dos que NO salen del skill son exactamente los declarados", () => {
    /*
     * `--vivo` y `--senal` son de J-Tel y entran por la enmienda (d). La lista
     * se fija aquí para que agregar un tercero no pase callado: quien lo agregue
     * tiene que tocar esta prueba, y al tocarla lee por qué.
     */
    const fuera = [...paletaDia.keys()].filter((k) => !skill.has(k));
    expect(fuera.sort()).toEqual(["--senal", "--vivo"]);
  });

  it("no trae los colores de ruta de muestra, que en la app salen del dato", () => {
    /*
     * La trampa del #370: `--ruta` no tiene par de noche a propósito, porque lo
     * inyecta el componente que sabe de qué ruta habla. Un valor por omisión en
     * `:root` se queda con el tono de DÍA en los dos temas mientras el texto de
     * encima sí sigue al tema — blanco sobre blanco, sin romper nada.
     */
    for (const t of ["--ruta", "--ruta-51", "--ruta-morada"]) {
      expect(paletaDia.has(t), `«${t}» es de maqueta: en la app el color de ruta sale de color_hex`).toBe(false);
    }
  });

  it("ningún hex suelto en la piel: todo pasa por un token", () => {
    /*
     * Se mira `ontoy.css`, que es donde se escribe una pantalla. Los hex que
     * quedan viven en comentarios —un número de PR y un color citado en prosa—,
     * así que se miran sólo las declaraciones.
     */
    const sinComentarios = cssPiel.replace(/\/\*[\s\S]*?\*\//g, "");
    const sueltos = [...sinComentarios.matchAll(/:\s*[^;}]*?(#[0-9a-f]{3,8})\b/gi)].map((m) => m[1]);
    expect(sueltos, "un color nuevo entra por tokens/colors.css del skill o por su ENMIENDAS.md").toEqual([]);
  });
});

/*
 * ── El contraste, piel por piel ──────────────────────────────────────
 *
 * Los pisos son los del Marco: **4.5:1 para texto** y **3:1 para lo gráfico**.
 * Cada renglón dice qué papel cae sobre qué superficie, que es como se lee la
 * app de verdad.
 */
const TEXTO: Array<[string, string]> = [
  ["--texto", "--fondo"],
  ["--texto", "--panel"],
  ["--texto", "--panel2"],
  ["--tenue", "--fondo"],
  ["--tenue", "--panel"],
  ["--tenue", "--panel2"],
];

const GRAFICO: Array<[string, string]> = [
  ["--vivo", "--fondo"],
  ["--vivo", "--panel"],
  ["--senal", "--fondo"],
  ["--senal", "--panel"],
];

describe.each([
  ["de día", papelesDia, paletaDia],
  ["de noche", papelesNoche, paletaNoche],
])("el contraste %s", (_piel, papeles, paleta) => {
  /*
   * Un papel se busca primero en `ontoy.css` —`--texto`, `--fondo`— y si no
   * está, en la paleta: `--vivo` y `--senal` no tienen papel intermedio, se
   * usan por su nombre de token. Si no está en ninguna de las dos, se deja el
   * nombre crudo y la cuenta da NaN, que falla la prueba en vez de pasarla.
   */
  const resolver = (rol: string) => hex(papeles.get(rol) ?? paleta.get(rol) ?? rol, paleta);

  it.each(TEXTO)("%s sobre %s llega al piso del texto (4.5:1)", (fg, bg) => {
    expect(contraste(resolver(fg), resolver(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(GRAFICO)("%s sobre %s llega al piso de lo gráfico (3:1)", (fg, bg) => {
    expect(contraste(resolver(fg), resolver(bg))).toBeGreaterThanOrEqual(3);
  });

  it("el texto apagado NO usa --gris, que no alcanza sobre el fondo", () => {
    /*
     * La enmienda (e) del skill, hecha prueba. `--gris` mide 4.16:1 sobre
     * `--banqueta`: está calibrado para las superficies, no para el fondo de la
     * página, y la línea de contexto del encabezado va justo ahí.
     *
     * Esto **no prohíbe `--gris`** — sigue siendo el token del sistema y sirve
     * sobre hueso. Prohíbe que sea el papel de «texto apagado», que es el que
     * cae sobre cualquier cosa.
     */
    expect(papeles.get("--tenue")).not.toContain("--gris");
  });
});

describe("la barra del sistema es la de la identidad", () => {
  /*
   * `themeColor` lo lee el sistema operativo, no el navegador: ahí no hay hoja
   * de estilos que resolver, así que va en literal. Esta prueba es lo que
   * impide que el literal y la paleta se separen — que es exactamente lo que
   * había pasado: la noche seguía en `#141225`, el morado del prototipo, mucho
   * después de que la identidad dijera Azul noche.
   *
   * **Se lee el archivo como texto y no se importa**, aunque importar sería más
   * limpio: `layout.tsx` llama a `next/font/local`, que sólo existe dentro del
   * compilador de Next y revienta bajo vitest. Es la misma razón por la que
   * `direcciones.test.ts` lee `page.tsx` en vez de importarlo.
   */
  const layout = readFileSync(path.join(AQUI, "layout.tsx"), "utf8");
  const bloqueTema = layout.slice(layout.indexOf("themeColor: ["), layout.indexOf("],", layout.indexOf("themeColor: [")));
  const colores = [...bloqueTema.matchAll(/color:\s*"(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase());

  it("el día es Banqueta y la noche es Azul noche", () => {
    expect(colores).toEqual([hex("var(--banqueta)", paletaDia), hex("var(--noche)", paletaDia)]);
  });
});

describe("lo que se mide y NO se exige, para que el número esté escrito", () => {
  /*
   * Los bordes no llegan a 3:1 y se quedan así: es el diseño aprobado (ASAV,
   * 24-sep) y es lo que la app ya tenía. Esta prueba no falla por eso — falla
   * si alguien los cambia **creyendo** que no se ven, porque entonces el número
   * de abajo deja de cuadrar y hay que volver a mirarlos.
   */
  it.each([
    ["de día", papelesDia, paletaDia, 1.2],
    ["de noche", papelesNoche, paletaNoche, 1.5],
  ])("el borde %s mide lo que se midió", (_piel, papeles, paleta, esperado) => {
    const r = contraste(hex(papeles.get("--linea")!, paleta), hex(papeles.get("--fondo")!, paleta));
    expect(Math.abs(r - esperado), `el borde mide ${r}:1 y se había medido ${esperado}:1 — vuelve a mirarlo`).toBeLessThan(0.05);
  });
});

/**
 * **La placa de ruta no sigue la piel.**
 *
 * Es la valla del defecto que cazó el Chat C: `.ontoy-placa` se pintaba con
 * `var(--texto)` y `var(--panel)` —los roles de tinta y papel—, que se voltean
 * con la piel. De noche la placa salía hueso con número oscuro, al revés de la
 * lámina.
 *
 * ## Lo que esta valla NO prueba
 *
 * No prueba que la placa se vea bien, ni que el anillo se distinga en un
 * teléfono de verdad: eso lo dice la revisión visual y por eso el PR lleva sus
 * capturas de noche. Prueba **que el color no dependa de la piel**, que es
 * exactamente lo que se rompió y lo que nadie ve leyendo el archivo — el
 * defecto vivió desde que la placa existe y sólo se vio en una captura nocturna.
 */
describe("la placa de ruta es carbón en las dos pieles", () => {
  /*
   * `declaraciones` sólo lee propiedades PERSONALIZADAS (`--x: y`), que es lo
   * que el resto de este archivo mide. Aquí hacen falta las normales
   * —`background`, `color`, `box-shadow`—, así que van con su propio lector.
   */
  function propiedades(css: string): Map<string, string> {
    const m = new Map<string, string>();
    for (const [, nombre, valor] of css.matchAll(/(?:^|[;{])\s*([a-z-]+)\s*:\s*([^;}]+)/gi)) {
      if (!nombre.startsWith("--")) m.set(nombre.toLowerCase(), valor.trim());
    }
    return m;
  }
  const placa = propiedades(bloque(cssPiel, ".ontoy-placa"));
  const fondo = placa.get("background");
  const letra = placa.get("color");

  it("declara un fondo y una letra", () => {
    expect(fondo).toBeTruthy();
    expect(letra).toBeTruthy();
  });

  it("NO se pinta con los roles que se voltean", () => {
    /*
     * La comprobación directa del defecto. `--texto`, `--panel`, `--fondo` y
     * `--tenue` cambian con la piel; una placa que los use cambia con ella.
     */
    for (const rol of ["--texto", "--panel", "--panel2", "--fondo", "--tenue"]) {
      expect(fondo).not.toContain(rol);
      expect(letra).not.toContain(rol);
    }
  });

  it("da EL MISMO carbón de día y de noche", () => {
    const deDia = hex(fondo!, papelesDia.size ? new Map([...paletaDia, ...papelesDia]) : paletaDia);
    const deNoche = hex(
      fondo!,
      papelesNoche.size ? new Map([...paletaNoche, ...papelesNoche]) : paletaNoche,
    );
    expect(deDia).toBe(deNoche);
    /* Y es el carbón de la paleta, el mismo que mide la lámina: #2a2e37. */
    expect(deDia).toBe(paletaDia.get("--carbon")!.toLowerCase());
  });

  it("da EL MISMO número hueso de día y de noche", () => {
    const deDia = hex(letra!, new Map([...paletaDia, ...papelesDia]));
    const deNoche = hex(letra!, new Map([...paletaNoche, ...papelesNoche]));
    expect(deDia).toBe(deNoche);
    expect(deDia).toBe(paletaDia.get("--hueso")!.toLowerCase());
  });

  it("el número se lee sobre la placa, en las dos pieles", () => {
    const f = hex(fondo!, new Map([...paletaDia, ...papelesDia]));
    const l = hex(letra!, new Map([...paletaDia, ...papelesDia]));
    /* 12.29:1 medido en la lámina. El piso de texto es 4.5. */
    expect(contraste(l, f)).toBeGreaterThanOrEqual(4.5);
  });

  it("de noche gana su anillo, porque el carbón sobre la noche no se ve", () => {
    /*
     * El carbón sobre la superficie de noche da 1.15:1: el rectángulo no se
     * distingue. El anillo es lo que le devuelve el borde, y el README lo pide
     * con todas sus letras. Sin esta prueba, quitarlo no rompería nada visible
     * en una captura de día.
     */
    const noche = propiedades(bloque(cssPiel, ':root[data-tema="noche"] .ontoy-placa'));
    expect(noche.get("box-shadow")).toContain("--noche-3");
    const carbon = paletaDia.get("--carbon")!.toLowerCase();
    const superficie = hex("var(--panel)", new Map([...paletaNoche, ...papelesNoche]));
    expect(contraste(carbon, superficie)).toBeLessThan(3);
  });
});
