import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { arranqueCorto, arranqueLargo } from "@/lib/fecha-arranque";

/*
 * **«Pronto me verás en la calle»**, y la valla que lo sostiene.
 *
 * ## Qué encontró esto, y estaba a la vista
 *
 * La app le enseñaba al pasajero **la fecha cruda de la base** —«Arranca el
 * 2026-10-01»— en cuatro pantallas. `lib/fecha-arranque.ts` existía desde el
 * #373 exactamente para eso, con su prueba y su trampa documentada, y **nadie
 * lo llamaba**. No es un defecto que rompa nada: es un módulo huérfano y una
 * pantalla fea, que es la clase de cosa que sobrevive meses.
 *
 * ## Qué NO prueba
 *
 * **No prueba que la fecha sea la correcta.** Eso es `fecha-arranque.test.ts`,
 * que sí mide el día civil y la trampa de `Date.UTC`. Aquí se prueba que la
 * pantalla **la pase por ahí** en vez de escribirla a mano.
 *
 * **No prueba cómo se ve la tarjeta.** Eso se mira.
 */

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(AQUI, "..", "..");

/**
 * Los comentarios fuera: esto mide **código**, no prosa.
 *
 * Sin esto, el propio comentario que explica «esta tarjeta no dice la
 * frecuencia» hacía fallar la prueba que comprueba que no la dice. Una valla
 * que se cae por su propia explicación enseña a borrar la explicación.
 */
function soloCodigo(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Todo el código de la app del pasajero, archivo por archivo. */
function fuentes(dir: string): Array<[string, string]> {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return fuentes(p);
    if (!/\.tsx?$/.test(e.name) || /\.test\.tsx?$/.test(e.name)) return [];
    return [[path.relative(SRC, p), readFileSync(p, "utf8")] as [string, string]];
  });
}

describe("la fecha de arranque nunca sale cruda a la pantalla", () => {
  /*
   * El molde que se prohíbe es **interpolar `arranca_el` dentro de una frase**.
   * Buscar la columna suelta daría falsos positivos —pasarla a una función es
   * legítimo, y es justo lo que ahora hacen las cuatro—; lo que no puede pasar
   * es que caiga tal cual dentro de un texto.
   */
  /*
   * Se mira **cada interpolación por separado**, no el archivo entero.
   *
   * La primera versión de esto excusaba el archivo completo en cuanto
   * encontraba UNA llamada correcta en cualquier línea — y la probé poniendo la
   * fecha cruda de vuelta: **pasó en verde**. Una valla que no se ve fallar no
   * prueba nada, y ésta habría dejado entrar exactamente lo que vino a impedir.
   *
   * Ahora cada `${...}` que nombre `arranca_el` tiene que pasar por la función
   * dentro de sí mismo.
   */
  const sospechosas = (fuente: string) =>
    [...soloCodigo(fuente).matchAll(/\$\{[^}]*arranca_el[^}]*\}/g)]
      .map((m) => m[0])
      .filter((trozo) => !/arranque(Corto|Largo)\(/.test(trozo));

  it("ninguna pantalla interpola arranca_el sin pasarlo por la función", () => {
    const culpables = fuentes(SRC).flatMap(([f, t]) =>
      sospechosas(t).map((trozo) => `${f}: ${trozo}`),
    );
    expect(
      culpables,
      "la fecha va por arranqueCorto() o arranqueLargo() de lib/fecha-arranque",
    ).toEqual([]);
  });

  it("hay archivos que revisar (guarda contra un falso verde)", () => {
    expect(fuentes(SRC).length).toBeGreaterThan(30);
  });

  it("y alguien SÍ llama al módulo: si nadie lo llama, volvió a quedar huérfano", () => {
    const llaman = fuentes(SRC).filter(
      ([f, t]) => !f.includes("fecha-arranque") && /arranque(Corto|Largo)\(/.test(t),
    );
    expect(llaman.map(([f]) => f).sort()).toEqual([
      "components/ontoy/atajo-de-parada.tsx",
      "components/ontoy/ontoy.tsx",
      "components/ontoy/pronto-en-la-calle.tsx",
      "components/ontoy/rutas-de-inicio.tsx",
    ]);
  });
});

describe("lo que la fecha dice, con el copy final del handoff", () => {
  it("la frase de la tarjeta lleva el día de la semana", () => {
    /*
     * «Arranca el **jueves** 1 de octubre.» Corrección de ASAV del 25-sep
     * encima del copy del handoff, que lo escribía sin él: «la gente se acuerda
     * del jueves». Va aquí porque quien compare la pantalla con el diseño va a
     * ver la diferencia y tiene que encontrar la razón, no un descuido.
     */
    expect(arranqueLargo("2026-10-01")).toBe("jueves 1 de octubre");
  });

  it("el renglón de la fila lo lleva abreviado y sin «de»", () => {
    /* En la columna estrecha, el «de» es el lugar que el «jue» necesita. */
    expect(arranqueCorto("2026-10-01")).toBe("jue 1 oct");
  });

  it("una fecha ilegible no dibuja frase, en vez de dibujar «null»", () => {
    expect(arranqueLargo("")).toBeNull();
    expect(arranqueCorto("mañana")).toBeNull();
  });
});

describe("el letrero de Cami", () => {
  const fuente = readFileSync(path.join(AQUI, "pronto-en-la-calle.tsx"), "utf8");

  it("sólo se pone si el nombre cabe entero", () => {
    /*
     * El dibujo del handoff lleva un NÚMERO de ruta en un hueco de 40 px. Las
     * rutas de aquí se llaman «Tecnológico–Norte», y recortarlo daba «Tecn»:
     * cuatro letras que no son el nombre de nada. Lo enseñó la captura.
     */
    expect(fuente).toContain("ruta.length <= 4");
    expect(fuente, "recortar un nombre inventa un rótulo").not.toContain("ruta.slice(");
  });
});

describe("la tarjeta no promete lo que no se ha operado", () => {
  const fuente = readFileSync(path.join(AQUI, "pronto-en-la-calle.tsx"), "utf8");
  const hoja = readFileSync(path.join(AQUI, "hoja-de-parada.tsx"), "utf8");

  it("no nombra la frecuencia ni una hora de apertura", () => {
    /*
     * Son los dos errores fáciles: «pasa cada 15 min» sobre un servicio que no
     * ha salido, y «abre 5:30», que es de OTRO estado —uno abre hoy más tarde,
     * el otro no ha abierto nunca—.
     */
    expect(soloCodigo(fuente)).not.toMatch(/promesa|frecuencia|cada \$\{|abre_a/i);
  });

  it("por arrancar REEMPLAZA a la promesa, no se suma a ella", () => {
    /*
     * Si la hoja dibujara las dos, el pasajero leería «Arranca el 1 de octubre»
     * y debajo «pasa cada 15 min», que es la promesa de un servicio que todavía
     * no existe.
     */
    const i = hoja.indexOf("porArrancar ? (");
    const j = hoja.indexOf("ontoy-hoja-promesa");
    expect(i, "la hoja tiene que ramificar por arrancar").toBeGreaterThan(0);
    expect(j, "la promesa vive dentro de la otra rama").toBeGreaterThan(i);
  });
});
