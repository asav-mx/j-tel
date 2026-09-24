import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/*
 * **La puerta del letrero no revela si una ruta existe.**
 *
 * Esto no prueba una función: prueba una DECISIÓN, y por eso lee el fuente —
 * como la valla de los textos de privacidad.
 *
 * Un `qr_slug` inventado y una parada de circuito sin publicar caen los dos en
 * `not-found.tsx` y leen **el mismo texto, palabra por palabra** (8.4: lo no
 * publicado no existe para la app). Cualquier diferencia entre las dos
 * respuestas confirma que la segunda existe, y quien prueba slugs a ver qué
 * contesta aprendería exactamente lo que no debe.
 *
 * La versión anterior decía «o su ruta todavía no está publicada». Era honesta y
 * **nombraba la causa**: con dos intentos, quien lee eso sabe cuál de los dos
 * casos le tocó. Es el tipo de frase que alguien vuelve a poner creyendo que
 * está siendo más claro con el pasajero, y esta valla es lo que se cae entonces.
 *
 * Que el dato no se filtre una capa más abajo ya lo cubre
 * `packages/db/src/qr-de-parada.integration.test.ts`, que comprueba contra la
 * base que las dos preguntas devuelven `null`. Esto cubre la de arriba: que la
 * pantalla tampoco lo diga con palabras.
 */

const fuente = (archivo: string) => readFileSync(new URL(`./${archivo}`, import.meta.url), "utf8");

/** Lo que el pasajero lee, sin los comentarios que explican por qué. */
const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** Las palabras que sólo pueden aparecer en un comentario, nunca en la pantalla. */
const DELATORAS = [/no est[áa] publicad/i, /sin publicar/i, /despublicad/i, /no existe/i];

describe("la puerta del letrero no revela nada", () => {
  it("el texto de «no activo» no nombra la publicación ni la existencia", () => {
    const visible = sinComentarios(fuente("not-found.tsx"));
    for (const delatora of DELATORAS) {
      expect(visible, `«${delatora}» en el texto que lee el pasajero`).not.toMatch(delatora);
    }
  });

  it("y dice «todavía no está activo», que sirve para los dos casos", () => {
    // «Todavía» es lo único que vale para un letrero recién pegado de un
    // circuito que aún no se publica Y para un código inventado: no promete una
    // fecha, no niega la parada, y no confirma ninguna de las dos.
    expect(fuente("not-found.tsx")).toContain("Este letrero todavía no está activo");
  });

  it("la página del QR manda los dos casos al MISMO sitio: un solo notFound()", () => {
    // Dos `notFound()` no serían un defecto por sí solos, pero dos RAMAS que
    // distingan el caso sin publicar del inventado sí: es por donde entraría una
    // pantalla propia para uno de los dos.
    const pagina = sinComentarios(fuente("[qrSlug]/page.tsx"));
    expect([...pagina.matchAll(/notFound\(\)/g)]).toHaveLength(1);
    for (const delatora of DELATORAS) {
      expect(pagina, `«${delatora}» en la página que resuelve el QR`).not.toMatch(delatora);
    }
  });
});
