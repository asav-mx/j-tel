/**
 * La bitácora del repo (`drizzle/meta/_journal.json`) contra los archivos que
 * hay en la carpeta.
 *
 * ## Por qué existe, y es la tercera vez
 *
 * El journal se llena **a mano** y el migrador no lo usa, así que olvidarlo no
 * rompe nada — y por eso se olvida. Va la tercera:
 *
 *   · **4 de agosto de 2026** — la `0017` nunca se anotó. Se descubrió de
 *     casualidad y se puso al día con la `0018`.
 *   · **27 de agosto de 2026** — la `0027`, la `0028` y la `0029` faltaban.
 *     La entrada de `DESPUES.md` se cerró con «al día con la `0030`», y dejó
 *     escrito que **la causa sigue viva**.
 *   · **10 de septiembre de 2026** — la `0032` y la `0033` faltaban. La causa
 *     seguía viva, en efecto.
 *
 * Cerrar el síntoma tres veces sin cerrar la causa es lo que este archivo
 * termina. **No es una prueba de una función: es una prueba de una disciplina**,
 * que es la clase que hace falta cuando el paso que se olvida no tiene ninguna
 * consecuencia inmediata.
 *
 * ## Qué NO prueba, y hay que leerlo antes que el verde
 *
 * **No prueba que ninguna migración esté aplicada en ninguna base.** Eso es
 * `verificar-migraciones-aplicadas.ts`, que pregunta por el efecto en el
 * catálogo de Postgres, y son preguntas distintas: aquí se comprueba que el
 * índice del repo describe los archivos del repo, y nada más.
 *
 * **No prueba que el orden del journal sea el orden real de aplicación.** Los
 * archivos se aplican por nombre; el `idx` es el índice del renglón. Que
 * coincidan es lo que se comprueba, no que ese orden sea correcto.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const DIR = path.join(import.meta.dirname, "..", "drizzle");

/** Las migraciones de verdad. Una marcha atrás no es una migración. */
function migracionesEnDisco(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".reversa.sql"))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
}

function journal(): { entries: Array<{ idx: number; tag: string }> } {
  return JSON.parse(readFileSync(path.join(DIR, "meta", "_journal.json"), "utf8"));
}

describe("la bitácora del repo está al día", () => {
  it("toda migración en disco tiene su renglón en el journal", () => {
    const anotadas = new Set(journal().entries.map((e) => e.tag));
    const faltantes = migracionesEnDisco().filter((m) => !anotadas.has(m));

    expect(
      faltantes,
      `Migraciones sin renglón en meta/_journal.json: ${faltantes.join(", ")}. ` +
        "Se agrega a mano, con el idx siguiente y el mismo tag que el nombre del " +
        "archivo. Ver docs/Procedimiento-Migraciones.md.",
    ).toEqual([]);
  });

  /**
   * La otra dirección, que importa igual: un renglón sin archivo es un índice
   * que promete una migración que no existe. Pasaría si alguien borra o
   * renombra un `.sql` y no toca el journal.
   */
  it("todo renglón del journal tiene su archivo en disco", () => {
    const enDisco = new Set(migracionesEnDisco());
    const huerfanos = journal()
      .entries.map((e) => e.tag)
      .filter((t) => !enDisco.has(t));

    expect(
      huerfanos,
      `Renglones del journal sin archivo .sql: ${huerfanos.join(", ")}.`,
    ).toEqual([]);
  });

  it("los idx no se repiten y van en orden", () => {
    const idx = journal().entries.map((e) => e.idx);
    expect(new Set(idx).size, "hay idx repetidos en el journal").toBe(idx.length);
    expect(idx, "los idx del journal no van en orden").toEqual([...idx].sort((a, b) => a - b));
  });

  /**
   * El journal se lee de arriba abajo como el orden de las migraciones, así que
   * si su orden y el de los archivos no coinciden, el índice engaña — que es lo
   * único que este archivo existe para dar.
   */
  it("el orden del journal es el orden en que se aplican los archivos", () => {
    expect(journal().entries.map((e) => e.tag)).toEqual(migracionesEnDisco());
  });
});
