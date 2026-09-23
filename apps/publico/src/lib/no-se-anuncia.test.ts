import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import config, { RUTAS_QUE_NO_SE_ANUNCIAN } from "../../next.config";
import robots from "../app/robots";
import { metadata } from "../app/validador/page";

/**
 * **El lector del camión no se anuncia.**
 *
 * Tres cosas tienen que ser ciertas a la vez, y ninguna sirve sola:
 *
 * 1. La respuesta trae `noindex` —en el HTML y en la cabecera—.
 * 2. `robots.txt` **no** lo prohíbe, porque prohibir el rastreo impide leer el
 *    `noindex` y consigue lo contrario.
 * 3. Nada de Ontoy lo enlaza: un buscador llega por donde alguien lo mandó.
 */
describe("la ruta del lector no se anuncia", () => {
  it("su HTML dice noindex", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("y su respuesta también, en la cabecera", async () => {
    const cabeceras = await config.headers!();
    const delValidador = cabeceras.filter((c) => c.source.startsWith("/validador"));
    expect(delValidador.length).toBe(RUTAS_QUE_NO_SE_ANUNCIAN.length);
    for (const c of delValidador) {
      expect(c.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, nofollow" });
    }
  });

  it("cubre también lo que cuelgue de la ruta, no sólo la ruta pelona", () => {
    expect(RUTAS_QUE_NO_SE_ANUNCIAN).toContain("/validador");
    expect(RUTAS_QUE_NO_SE_ANUNCIAN.some((r) => r.includes(":"))).toBe(true);
  });

  /*
   * La trampa que esta prueba vigila: alguien lee «no se anuncia», escribe
   * `Disallow: /validador` creyendo que ayuda, y con eso impide que el
   * rastreador lea el `noindex`. El razonamiento completo vive en robots.ts.
   */
  it("robots.txt NO prohíbe el lector: prohibir el rastreo esconde el noindex", () => {
    const reglas = robots().rules;
    const texto = JSON.stringify(reglas);
    expect(texto).not.toContain("validador");
  });

  it("robots.txt deja pasar la app del pasajero, y sólo aparta las consultas", () => {
    const reglas = robots().rules as { allow?: string; disallow?: string };
    expect(reglas.allow).toBe("/");
    expect(reglas.disallow).toBe("/api/");
  });
});

/** Todos los `.ts`/`.tsx` de un árbol. */
function archivosDe(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else if (/\.tsx?$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

describe("nada de Ontoy lleva al lector", () => {
  /*
   * El lector se abre tecleando su dirección en el teléfono del camión. Un
   * enlace desde la app del pasajero lo pondría a un toque de cualquiera que
   * esperara el camión —y, peor, le daría al rastreador el camino que el
   * `noindex` intenta cerrar.
   *
   * Se mira el código de las pantallas, no el de la propia carpeta del lector
   * ni sus comentarios: lo que se prohíbe es **navegar** ahí desde Ontoy.
   */
  it("ni un href, ni un push, ni un Link", () => {
    const raiz = new URL("../", import.meta.url).pathname;
    const sospechosos = archivosDe(join(raiz, "components", "ontoy"))
      .concat(archivosDe(join(raiz, "lib", "ontoy")))
      .concat([join(raiz, "app", "page.tsx")]);

    const culpables: string[] = [];
    for (const f of sospechosos) {
      const texto = readFileSync(f, "utf8");
      /* Una dirección entre comillas, no la palabra suelta de un comentario. */
      if (/["'`]\/validador/.test(texto)) culpables.push(f.replace(raiz, ""));
    }
    expect(culpables).toEqual([]);
  });
});
