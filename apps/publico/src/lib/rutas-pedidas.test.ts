import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { SLUGS_RESERVADOS } from "@jtel/domain";
import { direccionEnVivo, MAXIMO_RUTAS, rutasPedidas } from "@/lib/rutas-pedidas";

describe("las rutas que pide /api/circuitos/en-vivo", () => {
  it("sólo las pedidas, ordenadas y sin repetidas", () => {
    expect(rutasPedidas("zaragoza-centro, insurgentes,zaragoza-centro")).toEqual({
      ok: true,
      rutas: ["insurgentes", "zaragoza-centro"],
    });
  });

  it("sin lista no hay consulta: nunca «todas»", () => {
    expect(rutasPedidas(null).ok).toBe(false);
    expect(rutasPedidas("").ok).toBe(false);
    expect(rutasPedidas("*").ok).toBe(false);
  });

  it(`más de ${MAXIMO_RUTAS} rutas es barrer la ciudad, no seguir tus favoritas: 400`, () => {
    const muchas = Array.from({ length: MAXIMO_RUTAS + 1 }, (_, i) => `r${i}`).join(",");
    expect(rutasPedidas(muchas).ok).toBe(false);
  });

  it("el mismo conjunto de favoritas es la misma dirección, para que el CDN la comparta", () => {
    expect(direccionEnVivo(["b", "a", "b"])).toBe(direccionEnVivo(["a", "b"]));
    expect(direccionEnVivo(["a", "b"])).toBe("/api/circuitos/en-vivo?rutas=a,b");
  });
});

describe("todo lo que la app pide al servidor vive bajo un prefijo con regla de firewall", () => {
  /*
   * ✎ **Cambió el 23-sep-2026, con el P3.5.** Antes esto decía «no hay nada
   * fuera de /api/circuitos/» y comparaba contra esa única carpeta. La entrega
   * del lector no cabe ahí —no es un circuito— así que la valla se movió una
   * pulgada, y hacia arriba: ya no pregunta «¿es el prefijo de siempre?» sino
   * **«¿este prefijo tiene su regla escrita?»**, que era lo que se quería
   * desde el principio.
   *
   * El procedimiento es la única memoria de esas reglas: viven en el firewall
   * de Vercel y **no aparecen en ningún PR**. Un prefijo nuevo sin renglón ahí
   * es exactamente el hueco que ese archivo documenta haber costado cuatro
   * semanas de límite inexistente.
   */
  it("cada carpeta de /api/ está nombrada en el procedimiento del firewall", () => {
    const api = readdirSync(new URL("../app/api/", import.meta.url));
    const procedimiento = readFileSync(
      new URL("../../../../docs/Procedimiento-Firewall-Publico.md", import.meta.url),
      "utf8",
    );
    const sinRegla = api.filter((carpeta) => !procedimiento.includes(`/api/${carpeta}/`));
    expect(sinRegla).toEqual([]);
  });

  it("y las que hay son las que se esperan: una carpeta nueva se lee en el diff", () => {
    const api = readdirSync(new URL("../app/api/", import.meta.url));
    expect(api.sort()).toEqual(["boletos", "circuitos"]);
  });

  it("las carpetas fijas bajo /api/circuitos/ son nombres que ninguna ruta puede usar como slug", () => {
    const fijas = readdirSync(new URL("../app/api/circuitos/", import.meta.url)).filter((d) => !d.startsWith("["));
    // La lista vive en @jtel/domain (SLUGS_RESERVADOS) y J-Staff la usa para rechazar esos slugs al dar
    // de alta (PR 4a). Si agregas una carpeta fija aquí, agrégala allá: si no, esto se cae.
    expect(fijas.sort()).toEqual([...SLUGS_RESERVADOS].sort());
  });
});
