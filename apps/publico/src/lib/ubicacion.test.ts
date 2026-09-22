import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { estadoTrasError } from "@/lib/ubicacion";

describe("qué deja un error del GPS (bug del 22-sep-2026)", () => {
  it("el «no» del pasajero es «negada», haya habido posición o no", () => {
    expect(estadoTrasError(1, false)).toBe("negada");
    expect(estadoTrasError(1, true)).toBe("negada");
  });

  it("GPS apagado o tiempo agotado, sin posición todavía: «sin-senal», no «buscando» para siempre", () => {
    expect(estadoTrasError(2, false)).toBe("sin-senal");
    expect(estadoTrasError(3, false)).toBe("sin-senal");
  });

  it("si ya había posición, un túnel no la borra", () => {
    expect(estadoTrasError(2, true)).toBe("concedida");
    expect(estadoTrasError(3, true)).toBe("concedida");
  });
});

describe("el punto «tú» no se vuelve a perder en silencio", () => {
  /*
   * Se perdió una vez: la cara vieja (`vista-pasajero.tsx`) lo dibujaba, y el
   * PR #476 la reemplazó sin pasárselo a la nueva y sin decirlo. Esta valla
   * exige que CADA mapa de Ontoy reciba la posición del pasajero.
   */
  const ontoy = readFileSync(new URL("../components/ontoy/ontoy.tsx", import.meta.url), "utf8");
  const mapas = ontoy.match(/<VistaMapa\b[\s\S]*?\/>/g) ?? [];

  it("hay mapas que revisar (guarda contra un falso verde)", () => {
    expect(mapas.length).toBeGreaterThanOrEqual(2);
  });

  it("cada <VistaMapa> recibe yo={yo}", () => {
    for (const m of mapas) expect(m, m.slice(0, 80)).toContain("yo={yo}");
  });

  it("y la vista del mapa lo dibuja, en tinta y con la palabra «tú»", () => {
    const mapa = readFileSync(new URL("../components/ontoy/vista-mapa.tsx", import.meta.url), "utf8");
    expect(mapa).toContain('<span class="ontoy-tu-palabra">tú</span>');
  });
});
