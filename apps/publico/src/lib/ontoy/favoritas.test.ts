import { describe, expect, it } from "vitest";
import { rutasEnVivo, rutasFavoritas } from "@/lib/ontoy/favoritas";

const g = (parada: string, ruta: string) => ({ parada, ruta });

describe("las rutas favoritas en el Mapa de la ciudad", () => {
  it("son las de tus paradas guardadas, sin repetidas, en el orden en que las guardaste", () => {
    expect(rutasFavoritas([g("a", "norte"), g("b", "centro"), g("c", "norte")], ["centro", "norte", "sur"])).toEqual(["norte", "centro"]);
  });

  it("una ruta que dejó de publicarse no es favorita: no existe para la app", () => {
    expect(rutasFavoritas([g("a", "vieja"), g("b", "centro")], ["centro"])).toEqual(["centro"]);
  });

  it("en vivo van las favoritas menos las que apagaste", () => {
    expect(rutasEnVivo(["norte", "centro"], new Set(["norte"]))).toEqual(["centro"]);
  });

  it("sin favoritas no va ninguna en vivo — y no se le pregunta nada al servidor", () => {
    expect(rutasEnVivo(rutasFavoritas([], ["centro"]), new Set())).toEqual([]);
  });
});
