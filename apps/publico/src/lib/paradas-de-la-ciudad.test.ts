import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { paradasDeLaCiudad, type FuenteDeParadas } from "@/lib/paradas-de-la-ciudad";

/*
 * La lista de paradas de la ciudad lleva SÓLO lo público: parada, ruta y color
 * (decisión de ASAV, 22-sep; 9.14, primer cajón). Cero mediciones.
 *
 * La fuente de mentira trae A PROPÓSITO todo lo que no debe salir —los uuid, la
 * versión, la concesión, la velocidad, las unidades—, como lo traería una fila
 * de la base el día que alguien agregue una columna. Si algo de eso se cuela a
 * la respuesta, esto se cae. Es la valla de la decisión, no de una función.
 */

const CIRCUITOS = {
  "oasis-centro": {
    id: "uuid-interno-1",
    publicSlug: "oasis-centro",
    name: "Oasis–Centro",
    colorHex: "#6b4fa8",
    concessionId: "uuid-concesion",
    avgSpeedKmh: 20.5,
    arrivalRangeEnabledAt: null,
    publishedAt: new Date(),
  },
};

const PARADAS = [
  {
    stopId: "uuid-parada",
    versionId: "uuid-version",
    qrSlug: "hospital-general",
    name: "Hospital General",
    orden: 3,
    sentido: "ida",
    latitude: 31.7,
    longitude: -106.4,
    validFrom: new Date(),
    ultimoPaso: "2026-09-22T12:00:00Z",
    unidades: ["2120"],
    velocidadKmh: 18,
  },
  {
    stopId: "uuid-parada-2",
    versionId: "uuid-version-2",
    qrSlug: "plaza-de-armas",
    name: "Plaza de Armas",
    orden: 4,
    sentido: null,
    latitude: 31.71,
    longitude: -106.41,
    validFrom: new Date(),
  },
];

const fuente = (publicados: string[]): FuenteDeParadas => ({
  listPublishedCircuits: async () => publicados.map((publicSlug) => ({ publicSlug, name: "x" })),
  getPublishedCircuitBySlug: async (slug) => CIRCUITOS[slug as keyof typeof CIRCUITOS] ?? null,
  listStopsVigentes: async () => PARADAS,
});

describe("las paradas de la ciudad", () => {
  it("cada ruta lleva exactamente id, nombre y color", async () => {
    const { rutas } = await paradasDeLaCiudad(fuente(["oasis-centro"]));
    expect(rutas).toEqual([{ id: "oasis-centro", nombre: "Oasis–Centro", color_hex: "#6b4fa8" }]);
    for (const r of rutas) expect(Object.keys(r).sort()).toEqual(["color_hex", "id", "nombre"]);
  });

  it("cada parada lleva exactamente id, ruta, nombre, sentido y posición — nada medido, nada interno", async () => {
    const { paradas } = await paradasDeLaCiudad(fuente(["oasis-centro"]));
    expect(paradas).toHaveLength(2);
    for (const p of paradas) {
      expect(Object.keys(p).sort()).toEqual(["id", "lat", "lon", "nombre", "ruta", "sentido"]);
    }
    expect(paradas[0]).toEqual({
      id: "hospital-general",
      ruta: "oasis-centro",
      nombre: "Hospital General",
      sentido: "ida",
      lat: 31.7,
      lon: -106.4,
    });
    // Sin sentido es «sirve a los dos», no «no se sabe».
    expect(paradas[1]!.sentido).toBeNull();
  });

  it("ningún identificador interno ni medición aparece en ninguna parte de la respuesta", async () => {
    const texto = JSON.stringify(await paradasDeLaCiudad(fuente(["oasis-centro"])));
    for (const prohibido of ["uuid", "2120", "velocidad", "Paso", "20.5", "concesion"]) {
      expect(texto, prohibido).not.toContain(prohibido);
    }
  });

  it("lo que no está publicado no existe (8.4)", async () => {
    const lista = await paradasDeLaCiudad(fuente(["oasis-centro", "ruta-sin-publicar"]));
    expect(lista.rutas.map((r) => r.id)).toEqual(["oasis-centro"]);
    expect(new Set(lista.paradas.map((p) => p.ruta))).toEqual(new Set(["oasis-centro"]));
  });

  it("la ruta del servidor no arma nada por su cuenta: devuelve lo que armó esta función", () => {
    const ruta = readFileSync(new URL("../app/api/paradas/route.ts", import.meta.url), "utf8");
    expect(ruta).toContain("paradasDeLaCiudad(getRepos().circuits)");
    expect(ruta).toContain("NextResponse.json(lista,");
    // Un GET sin parámetros: nada del pasajero puede viajar en él.
    expect(ruta).toMatch(/export async function GET\(\)/);
  });
});
