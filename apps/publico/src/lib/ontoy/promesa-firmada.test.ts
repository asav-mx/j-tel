import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { promesaFirmada } from "./promesa-firmada";

/*
 * **LA FRECUENCIA LLEVA SU FIRMA** (auditoría del 25-sep). Inicio decía
 * «Frecuencia · cada 12 min» y la hoja del Mapa «… según la concesión»: la
 * misma promesa, una con dueño y otra sin él.
 */

describe("lo que la concesión declaró, firmado", () => {
  it("una frecuencia declarada lleva «según la concesión»", () => {
    expect(promesaFirmada({ estado: "declarada", ida: 12, vuelta: 12 }, null)).toBe(
      "Frecuencia · cada 12 min · según la concesión",
    );
    expect(promesaFirmada({ estado: "declarada", ida: 12, vuelta: 20 }, "vuelta")).toBe(
      "Frecuencia · cada 20 min · según la concesión",
    );
  });

  it("lo que no dijo nadie no se firma: sería atribuirle un hueco a la concesión", () => {
    expect(promesaFirmada({ estado: "sin_capturar" }, null)).toBe("Esta ruta no publica cada cuánto pasa");
    expect(promesaFirmada({ estado: "sin_franja" }, null)).toBe("Sin frecuencia publicada para esta hora");
    expect(promesaFirmada(null, null)).toBeNull();
  });
});

describe("ninguna pantalla escribe la frecuencia sin firma", () => {
  /*
   * Lee el fuente: una prueba de unidad no ve que una pantalla vuelva a llamar
   * a `promesaEnPalabras` a pelo. La única excepción es la hoja de parada, que
   * firma en su propio renglón (`promesaDeclarada`) — y por eso se exige que lo
   * siga haciendo.
   */
  const leer = (r: string) => readFileSync(new URL(r, import.meta.url), "utf8");

  it("Inicio (tarjeta y lista de rutas) y las paradas de una ruta usan la firmada", () => {
    for (const r of ["../../components/ontoy/atajo-de-parada.tsx", "../../components/ontoy/rutas-de-inicio.tsx"]) {
      expect(leer(r), r).toContain("promesaFirmada(");
      expect(leer(r), r).not.toContain("promesaEnPalabras(");
    }
    expect(leer("../../components/ontoy/ontoy.tsx")).toContain("<VistaParadas");
    expect(leer("../../components/ontoy/ontoy.tsx").match(/promesaEnPalabras\(/g) ?? []).toHaveLength(1);
  });

  it("y esa única llamada sin firma es la de la hoja, que firma aparte", () => {
    const ontoy = leer("../../components/ontoy/ontoy.tsx");
    const i = ontoy.indexOf("promesaEnPalabras(vivo?.promesa ?? null, sentidoDeLaHoja)");
    expect(i).toBeGreaterThan(0);
    expect(ontoy.slice(i, i + 300)).toContain('promesaDeclarada={vivo?.promesa?.estado === "declarada"}');
    expect(leer("../../components/ontoy/hoja-de-parada.tsx")).toContain("promesaDeclarada && <span");
  });
});
