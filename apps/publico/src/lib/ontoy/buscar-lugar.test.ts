import { describe, expect, it } from "vitest";
import {
  emparejarLugares,
  MAXIMO_SUGERENCIAS,
  normalizar,
  type ParadaBuscable,
  type RutaBuscable,
} from "./buscar-lugar";

const parada = (
  nombre: string,
  circuitoSlug = "oasis-centro",
  circuitoNombre = "Oasis–Centro",
): ParadaBuscable => ({
  id: `${circuitoSlug}-${normalizar(nombre).replace(/\s+/g, "-")}`,
  nombre,
  lat: 31.7,
  lon: -106.41,
  circuitoSlug,
  circuitoNombre,
});

const RUTAS: RutaBuscable[] = [{ slug: "oasis-centro", nombre: "Oasis–Centro" }];

describe("normalizar", () => {
  it("quita acentos y mayúsculas: el teclado en la calle no siempre acentúa", () => {
    expect(normalizar("Peñón")).toBe("penon");
    expect(normalizar("  HOSPITAL  ")).toBe("hospital");
    expect(normalizar("Plaza de Armas")).toBe("plaza de armas");
  });
});

describe("emparejarLugares", () => {
  const PARADAS = [
    parada("Centro"),
    parada("Mercado Central"),
    parada("Hospital"),
    parada("Plaza de Armas"),
    parada("Terminal Norte"),
  ];

  it("sin consulta no sugiere nada: la lista vacía no se llena de relleno", () => {
    expect(emparejarLugares("", PARADAS, RUTAS).sugerencias).toEqual([]);
    expect(emparejarLugares("   ", PARADAS, RUTAS).sugerencias).toEqual([]);
  });

  it("lo que EMPIEZA igual va antes de lo que sólo contiene", () => {
    const { sugerencias } = emparejarLugares("cen", PARADAS, RUTAS);
    expect(sugerencias[0].nombre).toBe("Centro");
    expect(sugerencias.map((s) => s.nombre)).toContain("Mercado Central");
  });

  it("encuentra sin acentos y sin mayúsculas", () => {
    expect(emparejarLugares("PLAZA", PARADAS, RUTAS).sugerencias[0].nombre).toBe("Plaza de Armas");
    expect(emparejarLugares("armas", PARADAS, RUTAS).sugerencias[0].nombre).toBe("Plaza de Armas");
  });

  it("una parada trae sus coordenadas: es lo que se puede medir contra el recorrido", () => {
    const s = emparejarLugares("hospital", PARADAS, RUTAS).sugerencias[0];
    expect(s.tipo).toBe("parada");
    if (s.tipo !== "parada") return;
    expect(s.lat).toBeCloseTo(31.7);
    expect(s.lon).toBeCloseTo(-106.41);
  });

  it("el nombre de una RUTA se ofrece aparte, no como destino", () => {
    const { sugerencias } = emparejarLugares("oasis", PARADAS, RUTAS);
    expect(sugerencias).toHaveLength(1);
    expect(sugerencias[0].tipo).toBe("ruta");
    if (sugerencias[0].tipo !== "ruta") return;
    expect(sugerencias[0].slug).toBe("oasis-centro");
  });

  it("a igualdad de coincidencia, el destino va antes que la ruta", () => {
    // «Centro» empieza igual en la parada y está contenido en «Oasis–Centro».
    const { sugerencias } = emparejarLugares("centro", PARADAS, RUTAS);
    expect(sugerencias[0].tipo).toBe("parada");
    expect(sugerencias.some((s) => s.tipo === "ruta")).toBe(true);
  });

  it("DOS PARADAS CON EL MISMO NOMBRE NO SE FUNDEN: son lugares distintos", () => {
    /*
     * Es la §D del Marco, caso de la UNIDAD, aplicada aquí: deduplicar por
     * nombre daría una lista más corta y más falsa, y mandaría al pasajero a la
     * esquina equivocada. Cada una viaja con el nombre de su ruta, que es lo
     * que le permite distinguirlas.
     */
    const dos = [parada("Centro"), parada("Centro", "juarez-sur", "Juárez Sur")];
    const { sugerencias } = emparejarLugares("centro", dos, []);

    expect(sugerencias).toHaveLength(2);
    expect(sugerencias.map((s) => s.tipo === "parada" && s.circuitoNombre).sort()).toEqual([
      "Juárez Sur",
      "Oasis–Centro",
    ]);
    // Y las claves son distintas: la lista de React no las colapsa.
    expect(new Set(sugerencias.map((s) => s.clave)).size).toBe(2);
  });

  it("lo que no coincide con nada no inventa una sugerencia", () => {
    const { sugerencias, omitidas } = emparejarLugares("aeropuerto", PARADAS, RUTAS);
    expect(sugerencias).toEqual([]);
    expect(omitidas).toBe(0);
  });

  it("el corte NO es silencioso: dice cuántas quedaron fuera", () => {
    const muchas = Array.from({ length: MAXIMO_SUGERENCIAS + 4 }, (_, i) =>
      parada(`Parada ${i}`, `ruta-${i}`, `Ruta ${i}`),
    );
    const { sugerencias, omitidas } = emparejarLugares("parada", muchas, []);

    expect(sugerencias).toHaveLength(MAXIMO_SUGERENCIAS);
    expect(omitidas).toBe(4);
  });
});
