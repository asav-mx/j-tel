import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { recorridosDeLaCiudad, type FuenteDeRecorridos } from "@/lib/recorridos-de-la-ciudad";

/*
 * Lo que la app del pasajero recibe de los recorridos (8.16.5): el tramo, su
 * sentido, sus travesías y su rango. La fuente de mentira trae A PROPÓSITO lo
 * que no debe salir; si algo se cuela, esto se cae.
 */

const fuente = (filas: Array<Record<string, unknown>>): FuenteDeRecorridos => ({
  recorridosPublicados: async () => filas as never,
});

const fila = (o: Record<string, unknown> = {}) => ({
  ruta: "zaragoza-centro",
  sentido: "ida",
  de: "zaragoza-sur",
  a: "zaragoza-y-torres",
  travesias: 14,
  desdeSeg: 300,
  medianaSeg: 320,
  hastaSeg: 340,
  ventanaHasta: new Date("2026-09-22T07:10:00Z"),
  // Nada de esto existe en la tabla; si algún día existiera, no debe salir.
  unitId: "uuid-de-la-unidad",
  carrierName: "Transportista que no debe salir",
  ...o,
});

describe("los recorridos que recibe el pasajero", () => {
  it("por ruta, con sus tramos y la ventana medida", async () => {
    const r = await recorridosDeLaCiudad(fuente([fila(), fila({ sentido: "vuelta", de: "a", a: "b" })]));
    expect(r).toHaveLength(1);
    expect(r[0]!.ruta).toBe("zaragoza-centro");
    expect(r[0]!.medido_hasta).toBe("2026-09-22T07:10:00.000Z");
    expect(r[0]!.tramos).toHaveLength(2);
  });

  it("cada tramo lleva exactamente sus siete campos, y ninguno es de la unidad ni del transportista", async () => {
    const r = await recorridosDeLaCiudad(fuente([fila()]));
    expect(Object.keys(r[0]!.tramos[0]!).sort()).toEqual([
      "a",
      "de",
      "desde_seg",
      "hasta_seg",
      "mediana_seg",
      "sentido",
      "travesias",
    ]);
    const texto = JSON.stringify(r);
    for (const prohibido of ["uuid-de-la-unidad", "Transportista", "unitId", "carrier"]) {
      expect(texto, prohibido).not.toContain(prohibido);
    }
  });

  it("la consulta sólo arma lo de aquí: nada de lectura propia", () => {
    const ruta = readFileSync(new URL("../app/api/circuitos/recorridos/route.ts", import.meta.url), "utf8");
    expect(ruta).toContain("recorridosDeLaCiudad(getRepos().circuits)");
    // Una sola lectura, la del resumen: `recorridosPublicados`. Nada más del repositorio.
    expect(ruta.match(/getRepos\(\)/g)).toHaveLength(1);
  });

  /*
   * ✎ Que la app del pasajero NO toque los pasos del detector lo vigila la valla
   * del muro de cuenta (`packages/services/src/guardia-muro-cuenta.test.ts`), que
   * barre todos los archivos. Aquí no se repite: nombrar esa tabla —aunque sea
   * para afirmar que no se usa— la haría aparecer en el barrido de la valla, y
   * una valla que se dispara con su propia prueba deja de decir nada.
   */
});
