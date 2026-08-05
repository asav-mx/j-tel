import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DESTINO_SIN_PASO } from "./guardia-pagina";

/**
 * La puerta — pieza 1.i.
 *
 * Estas pruebas no miden estilo ni copia: miden las dos formas en que este
 * cambio se puede romper en silencio.
 *
 * 1. **El destino apunta a una pantalla que no existe o que sí está guardada.**
 *    Lo primero da un 404 al negar el paso; lo segundo, un bucle de
 *    redirecciones. Las dos se ven igual de mal y ninguna prueba de unidad las
 *    tocaría, porque el destino es una cadena y una cadena siempre "funciona".
 * 2. **Un motivo nuevo sin traducir.** La guardia manda códigos cortos; si
 *    alguien agrega el quinto y no lo traduce, la puerta lo enseña como texto
 *    crudo o —peor— cae al caso genérico y le dice "entra" a quien ya entró.
 *
 * Se leen del árbol de archivos y del fuente, igual que
 * `guardia-cobertura.test.ts`: es la técnica que hace que una pantalla nueva
 * nazca en rojo en vez de nacer callada.
 */

const APP = path.join(fileURLToPath(new URL("../app", import.meta.url)));
const LIB = path.join(fileURLToPath(new URL(".", import.meta.url)));

const paginaDelDestino = path.join(APP, DESTINO_SIN_PASO.replace(/^\//, ""), "page.tsx");

describe("el destino de la negativa", () => {
  it("es /entrar y no la pantalla de diagnóstico", () => {
    // `/quien-soy` enseña el origen de la identidad, las membresías y si el
    // encabezado fue rechazado. Es el tablero del taller, no la puerta.
    expect(DESTINO_SIN_PASO).toBe("/entrar");
    expect(DESTINO_SIN_PASO).not.toBe("/quien-soy");
  });

  it("apunta a una pantalla que existe", () => {
    expect(existsSync(paginaDelDestino), `No hay page.tsx en ${DESTINO_SIN_PASO}`).toBe(true);
  });

  /**
   * La que importa. Guardar el destino de la negativa hace que negar el paso
   * lleve a una pantalla que vuelve a negar el paso — un bucle que no rompe la
   * compilación, no falla ninguna otra prueba, y deja la app inservible para
   * exactamente la persona que estaba tratando de entrar.
   */
  it("no lleva guardia, o sería un bucle de redirecciones", () => {
    const fuente = readFileSync(paginaDelDestino, "utf8");
    for (const guardia of ["exigirSesion(", "exigirEnPagina(", "exigirRecurso("]) {
      expect(fuente.includes(guardia), `${DESTINO_SIN_PASO} llama a ${guardia}`).toBe(false);
    }
  });
});

describe("los motivos que la guardia sabe mandar, la puerta los sabe decir", () => {
  it("los cuatro están traducidos en la pantalla", () => {
    const guardia = readFileSync(path.join(LIB, "guardia-pagina.ts"), "utf8");

    // La unión `MotivoDeNegativa`, leída del fuente porque un tipo no existe en
    // tiempo de ejecución. Si alguien agrega el quinto, aparece aquí solo.
    const union = guardia.match(/export type MotivoDeNegativa =([\s\S]*?);/)?.[1] ?? "";
    const motivos = [...union.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]!);

    // Que la extracción no se haya quedado vacía es parte de la prueba: cero
    // motivos pasarían en verde sin haber comprobado ninguno.
    expect(motivos.length).toBe(4);

    const puerta = readFileSync(paginaDelDestino, "utf8");
    const sinTraducir = motivos.filter((m) => !puerta.includes(`"${m}"`));

    expect(
      sinTraducir,
      `Motivos que la guardia manda y la puerta no sabe decir:\n${sinTraducir.join("\n")}`,
    ).toEqual([]);
  });
});
